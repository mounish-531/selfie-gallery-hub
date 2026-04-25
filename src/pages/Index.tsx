import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Camera, CalendarHeart, MessageSquareHeart, Mail, Lock, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="container flex items-center justify-between py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Selfie Gulfie</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <Button asChild variant="default"><Link to="/groups">Open dashboard</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
              <Button asChild><Link to="/auth?mode=signup">Get started</Link></Button>
            </>
          )}
        </nav>
      </header>

      <main className="container">
        <section className="py-16 md:py-28 text-center max-w-3xl mx-auto animate-fade-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> A private space for your group
          </span>
          <h1 className="mt-6 font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
            Every <span className="text-gradient">selfie, invite</span><br /> and moment — together.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
            Selfie Gulfie is a private home for your group's photos, event invitations and posts. Members get an email the moment something new lands.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="shadow-elegant"><Link to={user ? "/groups" : "/auth?mode=signup"}>Create your group</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to={user ? "/groups" : "/auth"}>Join with code</Link></Button>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3 pb-20">
          {[
            { icon: Camera, title: "Shared photo gallery", desc: "Drop in selfies, candids and event shots — all in one elegant feed." },
            { icon: CalendarHeart, title: "Event invitations", desc: "Post invites with date, location and an attached image or PDF." },
            { icon: MessageSquareHeart, title: "Group posts", desc: "Quick announcements and notes for everyone in the group." },
            { icon: Lock, title: "Invite-only via code", desc: "Anyone can sign up. Joining your group needs a secret code." },
            { icon: Mail, title: "Smart email alerts", desc: "Add a custom message; members choose what they want to hear about." },
            { icon: Sparkles, title: "Built for the group", desc: "Designed dark, calm and elegant so your photos take center stage." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-6 transition-smooth hover:shadow-elegant hover:-translate-y-1">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="container py-8 text-center text-sm text-muted-foreground border-t border-border">
        Selfie Gulfie · Private group sharing
      </footer>
    </div>
  );
};

export default Index;
