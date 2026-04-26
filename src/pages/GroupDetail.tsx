import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Camera, CalendarHeart, MessageSquareHeart, Upload, Settings, Copy, MapPin, Calendar, Users } from "lucide-react";

interface Group { id: string; name: string; description: string | null; join_code: string; creator_id: string; }
interface Photo { id: string; image_url: string; caption: string | null; uploader_id: string; created_at: string; uploader?: { display_name: string }; }
interface Event { id: string; title: string; description: string | null; event_date: string | null; location: string | null; invite_url: string | null; uploader_id: string; created_at: string; uploader?: { display_name: string }; }
interface Post { id: string; title: string; content: string; uploader_id: string; created_at: string; uploader?: { display_name: string }; }
interface Prefs { notify_photos: boolean; notify_events: boolean; notify_posts: boolean; }

const GroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [prefs, setPrefs] = useState<Prefs>({ notify_photos: true, notify_events: true, notify_posts: true });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-group-content", {
        body: { group_id: id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGroup(data.group as Group);
      setPhotos((data.photos as Photo[]) || []);
      setEvents((data.events as Event[]) || []);
      setPosts((data.posts as Post[]) || []);
      setMemberCount(data.memberCount || 0);
      if (data.prefs) {
        setPrefs({
          notify_photos: data.prefs.notify_photos,
          notify_events: data.prefs.notify_events,
          notify_posts: data.prefs.notify_posts,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Could not load group content");
      navigate("/groups");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  const updatePref = async (key: keyof Prefs, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !id) return;
    const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, group_id: id, ...prefs, [key]: value }, { onConflict: "user_id,group_id" });
    if (error) toast.error(error.message);
  };

  const copyCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.join_code);
    toast.success("Code copied");
  };

  if (loading || !group) {
    return <AppShell><div className="container py-10 text-muted-foreground">Loading…</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="container py-8 space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/groups" className="hover:text-foreground inline-flex items-center"><ArrowLeft className="h-4 w-4 mr-1" /> All groups</Link>
        </div>

        <Card className="glass">
          <CardContent className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold">{group.name}</h1>
              {group.description && <p className="text-muted-foreground mt-1">{group.description}</p>}
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> {memberCount} member{memberCount === 1 ? "" : "s"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={copyCode} className="glass rounded-xl px-4 py-2.5 text-left transition-smooth hover:shadow-glow">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Group code</div>
                <div className="flex items-center gap-2 font-mono font-bold tracking-widest text-primary">{group.join_code} <Copy className="h-3.5 w-3.5" /></div>
              </button>
              <PrefsDialog prefs={prefs} onChange={updatePref} />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="photos" className="w-full">
          <TabsList className="grid grid-cols-3 max-w-md">
            <TabsTrigger value="photos"><Camera className="h-4 w-4 mr-1.5" /> Photos</TabsTrigger>
            <TabsTrigger value="events"><CalendarHeart className="h-4 w-4 mr-1.5" /> Events</TabsTrigger>
            <TabsTrigger value="posts"><MessageSquareHeart className="h-4 w-4 mr-1.5" /> Posts</TabsTrigger>
          </TabsList>

          <TabsContent value="photos" className="mt-6">
            <PhotoSection groupId={group.id} groupName={group.name} photos={photos} onChange={load} />
          </TabsContent>
          <TabsContent value="events" className="mt-6">
            <EventSection groupId={group.id} groupName={group.name} events={events} onChange={load} />
          </TabsContent>
          <TabsContent value="posts" className="mt-6">
            <PostSection groupId={group.id} groupName={group.name} posts={posts} onChange={load} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

const PrefsDialog = ({ prefs, onChange }: { prefs: Prefs; onChange: (k: keyof Prefs, v: boolean) => void }) => (
  <Dialog>
    <DialogTrigger asChild><Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button></DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Email notifications</DialogTitle>
        <DialogDescription>Choose what you want to be emailed about for this group.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {[
          { key: "notify_photos" as const, label: "New photos" },
          { key: "notify_events" as const, label: "New events / invitations" },
          { key: "notify_posts" as const, label: "New posts" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <Label htmlFor={key}>{label}</Label>
            <Switch id={key} checked={prefs[key]} onCheckedChange={(v) => onChange(key, v)} />
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);

async function uploadFile(file: File, groupId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const ext = file.name.split(".").pop();
  const path = `${groupId}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("group-uploads").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("group-uploads").getPublicUrl(path);
  return data.publicUrl;
}

async function notify(groupId: string, type: "photos" | "events" | "posts", title: string, customMessage: string | undefined, groupName: string) {
  try {
    await supabase.functions.invoke("notify-group", {
      body: { group_id: groupId, type, title, custom_message: customMessage || null, group_name: groupName },
    });
  } catch (e) {
    console.error("notify failed", e);
  }
}

const PhotoSection = ({ groupId, groupName, photos, onChange }: { groupId: string; groupName: string; photos: Photo[]; onChange: () => void }) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error("Pick a photo"); return; }
    setBusy(true);
    try {
      const url = await uploadFile(file, groupId);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("photos").insert({
        group_id: groupId, uploader_id: user!.id, image_url: url,
        caption: caption.trim() || null, custom_message: message.trim() || null,
      });
      if (error) throw error;
      toast.success("Photo shared!");
      await notify(groupId, "photos", caption.trim() || "New photo", message, groupName);
      setOpen(false); setFile(null); setCaption(""); setMessage("");
      onChange();
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Upload className="h-4 w-4 mr-2" /> Upload photo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Share a photo</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <input ref={inputRef} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
              <button type="button" onClick={() => inputRef.current?.click()} className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-secondary/50 transition-smooth">
                {file ? <span className="text-foreground">{file.name}</span> : <span className="text-muted-foreground">Click to choose an image</span>}
              </button>
              <div className="space-y-2"><Label>Caption (optional)</Label><Input maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="A moment to remember" /></div>
              <div className="space-y-2"><Label>Email message (optional)</Label><Textarea maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a note to include in the notification email" /></div>
              <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Sharing…" : "Share"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {photos.length === 0 ? (
        <EmptyState icon={Camera} text="No photos yet — be the first to share one." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl glass">
              <img src={p.image_url} alt={p.caption || "Group photo"} loading="lazy" className="w-full h-full object-cover transition-smooth group-hover:scale-105" />
              {(p.caption || p.uploader?.display_name) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-xs text-white">
                  {p.caption && <div className="font-medium truncate">{p.caption}</div>}
                  {p.uploader?.display_name && <div className="opacity-75">by {p.uploader.display_name}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EventSection = ({ groupId, groupName, events, onChange }: { groupId: string; groupName: string; events: Event[]; onChange: () => void }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", event_date: "", location: "", message: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setBusy(true);
    try {
      let invite_url: string | null = null;
      if (file) invite_url = await uploadFile(file, groupId);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("events").insert({
        group_id: groupId, uploader_id: user!.id,
        title: form.title.trim(), description: form.description.trim() || null,
        event_date: form.event_date || null, location: form.location.trim() || null,
        invite_url, custom_message: form.message.trim() || null,
      });
      if (error) throw error;
      toast.success("Event posted!");
      await notify(groupId, "events", form.title, form.message, groupName);
      setOpen(false); setForm({ title: "", description: "", event_date: "", location: "", message: "" }); setFile(null);
      onChange();
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Upload className="h-4 w-4 mr-2" /> Post event</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Post an event or invitation</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-2"><Label>Title *</Label><Input maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Diwali Get-together" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Date</Label><Input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
                <div className="space-y-2"><Label>Location</Label><Input maxLength={120} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Marina Bay" /></div>
              </div>
              <div className="space-y-2"><Label>Description</Label><Textarea maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <input ref={inputRef} type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
              <button type="button" onClick={() => inputRef.current?.click()} className="w-full border-2 border-dashed border-border rounded-xl p-4 text-center text-sm hover:bg-secondary/50">
                {file ? file.name : "Attach invitation image or PDF (optional)"}
              </button>
              <div className="space-y-2"><Label>Email message (optional)</Label><Textarea maxLength={500} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Personal note for the email" /></div>
              <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Posting…" : "Post event"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {events.length === 0 ? (
        <EmptyState icon={CalendarHeart} text="No events yet — share your first invitation." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((e) => (
            <Card key={e.id} className="glass overflow-hidden transition-smooth hover:shadow-elegant">
              {e.invite_url && /\.(png|jpe?g|gif|webp)$/i.test(e.invite_url) && (
                <img src={e.invite_url} alt={e.title} className="w-full h-48 object-cover" />
              )}
              <CardContent className="p-5 space-y-2">
                <h3 className="font-display text-2xl font-bold">{e.title}</h3>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {e.event_date && <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(e.event_date).toLocaleString()}</span>}
                  {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {e.location}</span>}
                </div>
                {e.description && <p className="text-sm">{e.description}</p>}
                {e.invite_url && !/\.(png|jpe?g|gif|webp)$/i.test(e.invite_url) && (
                  <a href={e.invite_url} target="_blank" rel="noreferrer" className="text-primary text-sm font-medium hover:underline">View invitation →</a>
                )}
                {e.uploader?.display_name && <div className="text-xs text-muted-foreground pt-1">Posted by {e.uploader.display_name}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const PostSection = ({ groupId, groupName, posts, onChange }: { groupId: string; groupName: string; posts: Post[]; onChange: () => void }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", message: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) { toast.error("Title and content required"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("posts").insert({
        group_id: groupId, uploader_id: user!.id,
        title: form.title.trim(), content: form.content.trim(),
        custom_message: form.message.trim() || null,
      });
      if (error) throw error;
      toast.success("Posted!");
      await notify(groupId, "posts", form.title, form.message, groupName);
      setOpen(false); setForm({ title: "", content: "", message: "" });
      onChange();
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Upload className="h-4 w-4 mr-2" /> New post</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Write a post</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-2"><Label>Title *</Label><Input maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-2"><Label>Content *</Label><Textarea maxLength={3000} rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email message (optional)</Label><Textarea maxLength={500} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Note for the notification email" /></div>
              <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Posting…" : "Publish"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {posts.length === 0 ? (
        <EmptyState icon={MessageSquareHeart} text="No posts yet — share an announcement." />
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <Card key={p.id} className="glass">
              <CardContent className="p-5">
                <h3 className="font-display text-2xl font-bold">{p.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{p.uploader?.display_name} · {new Date(p.created_at).toLocaleDateString()}</p>
                <p className="mt-3 whitespace-pre-wrap leading-relaxed">{p.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ icon: Icon, text }: { icon: any; text: string }) => (
  <Card className="glass text-center py-16"><CardContent><Icon className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">{text}</p></CardContent></Card>
);

export default GroupDetail;
