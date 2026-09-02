import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RazorReclaim — AI Revenue Recovery",
  description: "AI Decision & Execution Layer for Revenue Recovery",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider delay={200}>
          <header className="border-b border-white/[0.06] bg-background/80 backdrop-blur-md sticky top-0 z-40">
            <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2 group">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                <span className="font-semibold tracking-tight text-sm text-foreground">
                  Razor<span className="text-emerald-400">Reclaim</span>
                </span>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <NavLink href="/">Command Center</NavLink>
                <NavLink href="/approvals">Approval Queue</NavLink>
              </nav>
              <div className="ml-auto flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <span className="rounded-full border border-white/10 px-2 py-0.5">Test Mode</span>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <Toaster position="top-right" theme="dark" />
        </TooltipProvider>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
    >
      {children}
    </Link>
  );
}
