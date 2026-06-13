import Link from "next/link";
import { mockUser } from "@/lib/mock/user.mock";
import Logo from "./Logo";
import UserMenu from "./UserMenu";

export default function AppHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-logo-link" href="/dashboard">
          <Logo />
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          <Link className="nav-link" href="/dashboard">
            Dashboard
          </Link>
          <Link className="nav-link" href="/upload">
            New analysis
          </Link>
        </nav>

        <div className="site-header-actions">
          <Link className="btn btn-primary btn-sm desktop-only" href="/upload">
            New analysis
          </Link>
          <UserMenu user={mockUser} />
        </div>
      </div>
    </header>
  );
}
