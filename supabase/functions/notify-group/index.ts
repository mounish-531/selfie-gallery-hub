// Notifies all group members (respecting their preferences) by email when new content is posted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "@supabase/supabase-js/cors";

interface Body {
  group_id: string;
  type: "photos" | "events" | "posts";
  title: string;
  custom_message: string | null;
  group_name: string;
}

const TYPE_LABEL: Record<Body["type"], string> = {
  photos: "photo",
  events: "event",
  posts: "post",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body: Body = await req.json();
    if (!body?.group_id || !body?.type || !body?.title) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is a member
    const { data: membership } = await admin.from("group_members").select("id").eq("group_id", body.group_id).eq("user_id", user.id).maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get uploader display name
    const { data: uploaderProfile } = await admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    const uploaderName = uploaderProfile?.display_name || "A group member";

    // Get all members of this group
    const { data: members } = await admin.from("group_members").select("user_id").eq("group_id", body.group_id);
    const userIds = (members || []).map((m: any) => m.user_id).filter((uid: string) => uid !== user.id);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get prefs
    const prefField = `notify_${body.type}` as const;
    const { data: prefs } = await admin.from("notification_preferences").select(`user_id, ${prefField}`).eq("group_id", body.group_id).in("user_id", userIds);
    const optedIn = new Set((prefs || []).filter((p: any) => p[prefField] !== false).map((p: any) => p.user_id));
    // Default to opted-in if no row exists
    const recipientIds = userIds.filter((uid) => !prefs?.find((p: any) => p.user_id === uid) || optedIn.has(uid));
    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get emails
    const { data: profiles } = await admin.from("profiles").select("email, display_name").in("id", recipientIds);
    const emails = (profiles || []).map((p: any) => p.email).filter(Boolean);
    if (emails.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not set — skipping email send");
      return new Response(JSON.stringify({ ok: true, sent: 0, warning: "Email not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const label = TYPE_LABEL[body.type];
    const subject = `New ${label} in ${body.group_name}: ${body.title}`;
    const customBlock = body.custom_message
      ? `<div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:14px 16px;border-radius:8px;margin:18px 0;color:#451a03;font-style:italic;">${escapeHtml(body.custom_message)}</div>`
      : "";
    const html = `
      <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a;">
        <div style="text-align:center;padding:18px 0;">
          <div style="display:inline-block;padding:8px 18px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-weight:700;letter-spacing:1px;border-radius:999px;font-size:13px;">SELFIE GULFIE</div>
        </div>
        <h1 style="font-size:26px;margin:8px 0 6px;">New ${label} in <span style="color:#d97706;">${escapeHtml(body.group_name)}</span></h1>
        <p style="color:#525252;margin:0 0 16px;">${escapeHtml(uploaderName)} just shared: <strong>${escapeHtml(body.title)}</strong></p>
        ${customBlock}
        <a href="${escapeHtml(getOrigin(req))}/groups/${body.group_id}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;margin-top:8px;">Open in Selfie Gulfie</a>
        <p style="color:#a3a3a3;font-size:12px;margin-top:32px;">You can change which alerts you get from your group page → settings.</p>
      </div>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Selfie Gulfie <onboarding@resend.dev>",
        to: emails,
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Resend error", resp.status, errText);
      return new Response(JSON.stringify({ ok: false, error: errText }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, sent: emails.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function getOrigin(req: Request) {
  return req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "https://selfie-gulfie.app";
}
