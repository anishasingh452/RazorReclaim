"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitBranch, LayoutGrid, ListChecks, TrendingUp } from "lucide-react";

const LINKS = [
  { href: "/command-center", label: "Command Center", icon: LayoutGrid },
  { href: "/portfolio", label: "Portfolio", icon: TrendingUp },
  { href: "/approvals", label: "Approvals", icon: ListChecks },
  { href: "/conflicts", label: "Conflicts", icon: GitBranch },
] as const;

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5">
      {LINKS.map((link) => {
        // Case detail pages belong to the Command Center section.
        const active =
          link.href === "/command-center"
            ? pathname.startsWith("/command-center") || pathname.startsWith("/cases")
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {active && (
              <span className="absolute inset-0 rounded-lg border border-white/10 bg-white/[0.06]" />
            )}
            <link.icon
              className={`relative size-3.5 transition-colors ${
                active ? "text-emerald-400" : "text-muted-foreground/60 group-hover:text-muted-foreground"
              }`}
            />
            <span className="relative hidden sm:inline">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
