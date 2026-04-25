import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, KeyRound, Users, ArrowRight } from "lucide-react";

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  join_code: string;
  creator_id: string;
}

const generateCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const Groups = () => {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [joinCode, setJoinCode] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setGroups(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const schema = z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(300).optional() });
    const parsed = schema.safeParse(createForm);
    if (!parsed.success) { toast.error("Group name must be 2-60 characters"); return; }
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("groups").insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      join_code: generateCode(),
      creator_id: user.id,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Group created!");
    setCreateOpen(false);
    setCreateForm({ name: "", description: "" });
    load();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { toast.error("Enter a valid code"); return; }
    setJoining(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Find group by code via RPC-style: filter then attempt insert. RLS on groups won't let us SELECT a group we're not in/owner of, so use insert + foreign select trick.
    // Use a security-definer-free approach: try inserting membership using the code via a function — instead, do a lookup via the join code with anon-invisible select using a view? Simplest: create an RPC.
    const { data: groupId, error: rpcErr } = await supabase.rpc("join_group_by_code", { _code: code });
    setJoining(false);
    if (rpcErr) { toast.error(rpcErr.message); return; }
    if (!groupId) { toast.error("Invalid code"); return; }
    toast.success("Joined the group!");
    setJoinOpen(false);
    setJoinCode("");
    load();
  };

  return (
    <AppShell>
      <div className="container py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl font-bold">Your groups</h1>
            <p className="text-muted-foreground mt-1">Create a new group or join one with a code.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
              <DialogTrigger asChild><Button variant="outline"><KeyRound className="h-4 w-4 mr-2" /> Join with code</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Join a group</DialogTitle></DialogHeader>
                <form onSubmit={handleJoin} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Group code</Label>
                    <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" className="uppercase tracking-widest text-center text-lg" />
                  </div>
                  <DialogFooter><Button type="submit" disabled={joining}>{joining ? "Joining…" : "Join"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New group</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create a group</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Group name</Label>
                    <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="The Selfie Gulfie Squad" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Our private space" />
                  </div>
                  <DialogFooter><Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create group"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : groups.length === 0 ? (
          <Card className="glass text-center py-16">
            <CardContent>
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-lg font-medium">No groups yet</p>
              <p className="text-muted-foreground text-sm mt-1">Create one or ask the group creator for a code.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <Link key={g.id} to={`/groups/${g.id}`} className="block">
                <Card className="glass transition-smooth hover:shadow-elegant hover:-translate-y-1 h-full">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl flex items-center justify-between">
                      {g.name}
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </CardTitle>
                    {g.description && <CardDescription>{g.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground">Code</div>
                    <div className="font-mono font-bold tracking-widest text-primary">{g.join_code}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Groups;
