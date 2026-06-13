import Link from "next/link";
import Logo from "@/components/layout/Logo";

export default function LoginForm() {
  return (
    <main className="auth-layout">
      <section className="auth-brand-panel">
        <Logo />
        <div className="auth-brand-copy">
          <h1>Turn dense papers into proposals you can actually trust.</h1>
          <p>
            Veridoc reads the paper, drafts a plain-language proposal, and ties every
            claim back to the exact passage that supports it.
          </p>
          <ul className="auth-feature-list">
            <li>Problem, Solution, Evidence, and Feasibility in plain language</li>
            <li>Faithfulness score for every section</li>
            <li>Click any claim to see its supporting source passage</li>
          </ul>
        </div>
        <p className="auth-footer-note">Trusted by research teams for literature review</p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="mobile-logo">
            <Logo />
          </div>
          <div className="section-copy">
            <h2>Sign in</h2>
            <p>Welcome back. Continue to your workspace.</p>
          </div>

          <form className="form-stack">
            <label>
              Email
              <input placeholder="you@university.edu" type="email" />
            </label>
            <label>
              Password
              <input placeholder="••••••••" type="password" />
            </label>
            <Link className="btn btn-primary btn-full btn-lg" href="/dashboard">
              Sign in
            </Link>
          </form>

          <div className="split-divider">
            <span>or</span>
          </div>

          <Link className="btn btn-outline btn-full btn-lg" href="/dashboard">
            Continue with Google
          </Link>

          <p className="form-helper-text">
            No account? <Link href="/dashboard">Create one</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
