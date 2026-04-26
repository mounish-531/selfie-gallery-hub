import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  group_id: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "Backend is not configured" }, 500);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { group_id } = parsed.data;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: group, error: groupError } = await admin
      .from("groups")
      .select("*")
      .eq("id", group_id)
      .maybeSingle();

    if (groupError) throw groupError;
    if (!group) return json({ error: "Group not found" }, 404);

    const { data: membership, error: membershipError } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", group_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (group.creator_id !== user.id && !membership) return json({ error: "Not a group member" }, 403);

    const [photosRes, eventsRes, postsRes, membersRes, prefsRes] = await Promise.all([
      admin.from("photos").select("*").eq("group_id", group_id).order("created_at", { ascending: false }),
      admin.from("events").select("*").eq("group_id", group_id).order("created_at", { ascending: false }),
      admin.from("posts").select("*").eq("group_id", group_id).order("created_at", { ascending: false }),
      admin.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", group_id),
      admin.from("notification_preferences").select("*").eq("group_id", group_id).eq("user_id", user.id).maybeSingle(),
    ]);

    if (photosRes.error) throw photosRes.error;
    if (eventsRes.error) throw eventsRes.error;
    if (postsRes.error) throw postsRes.error;
    if (membersRes.error) throw membersRes.error;
    if (prefsRes.error) throw prefsRes.error;

    const uploaderIds = Array.from(new Set([
      ...(photosRes.data || []).map((item: any) => item.uploader_id),
      ...(eventsRes.data || []).map((item: any) => item.uploader_id),
      ...(postsRes.data || []).map((item: any) => item.uploader_id),
    ]));

    const profileMap: Record<string, { display_name: string }> = {};
    if (uploaderIds.length > 0) {
      const { data: profiles, error: profilesError } = await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", uploaderIds);
      if (profilesError) throw profilesError;
      (profiles || []).forEach((profile: any) => {
        profileMap[profile.id] = { display_name: profile.display_name };
      });
    }

    const attachUploader = (rows: any[]) => rows.map((row) => ({
      ...row,
      uploader: profileMap[row.uploader_id],
    }));

    return json({
      group,
      photos: attachUploader(photosRes.data || []),
      events: attachUploader(eventsRes.data || []),
      posts: attachUploader(postsRes.data || []),
      memberCount: membersRes.count || 0,
      prefs: prefsRes.data || null,
    });
  } catch (error: any) {
    console.error(error);
    return json({ error: error?.message || "Could not load group content" }, 500);
  }
});
