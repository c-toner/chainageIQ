import { redirect } from "next/navigation";
import { configured } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/data";
import Workspace from "@/components/workspace";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configured())
    return (
      <main className="setup-page">
        <div className="brand-mark">
          C<span>IQ</span>
        </div>
        <div className="eyebrow">INFRASTRUCTURE, IN FOCUS</div>
        <h1>
          Your next project.
          <br />
          On solid ground.
        </h1>
        <p>
          Track defects, inspections and corrective work at every chainage. Your
          ChainageIQ application is ready to connect.
        </p>
        <div className="setup-card">
          <span className="status-dot amber" />
          Workspace setup required<h2>Connect your Supabase project</h2>
          <p>
            Add the two Supabase environment variables and apply the database
            migration to enable secure sign-in and persistent project data.
          </p>
          <code>
            NEXT_PUBLIC_SUPABASE_URL
            <br />
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>
          <p>Deployment instructions are in the project README.</p>
          <Link className="button primary" href="/demo">
            Explore the demonstration
          </Link>
          <small>
            The demonstration is read-only and uses labelled sample records.
          </small>
        </div>
        <footer>
          CHAINAGEIQ <span>Built for the field. Ready for the whole team.</span>
        </footer>
      </main>
    );
  const data = await loadWorkspace();
  if (!data) redirect("/login");
  return <Workspace initial={data} />;
}
