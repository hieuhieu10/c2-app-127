import Link from "next/link";
import AppHeader from "./AppHeader";

type PageShellProps = {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  actionLabel?: string;
  actionHref?: string;
};

export default function PageShell({
  children,
  title,
  eyebrow,
  actionLabel,
  actionHref,
}: PageShellProps) {
  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <div className="page-title-row">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
          </div>
          {actionLabel && actionHref ? (
            <Link className="primary-action" href={actionHref}>
              {actionLabel}
            </Link>
          ) : null}
        </div>
        {children}
      </main>
    </>
  );
}
