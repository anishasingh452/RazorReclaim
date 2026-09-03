import { AppShell } from "@/components/chrome/app-shell";

/**
 * Chrome for the product itself. The marketing landing at `/` lives outside
 * this group so it can own the full viewport — no command bar, no ambient
 * grid competing with its own cinematic background.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
