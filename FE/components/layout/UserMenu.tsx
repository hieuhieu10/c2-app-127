"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { UserProfile } from "@/lib/types";

export default function UserMenu({ user }: { user: UserProfile }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  return (
    <div className="user-menu-root" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="user-avatar"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {user.initials}
      </button>

      {open ? (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>

          <div className="user-dropdown-actions">
            <Link className="user-dropdown-link" href="/profile" onClick={() => setOpen(false)}>
              Profile
            </Link>
            <Link className="user-dropdown-link" href="/login" onClick={() => setOpen(false)}>
              Log out
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
