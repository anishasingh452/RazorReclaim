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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <TooltipProvider delay={200}>
          <header className="border-b bg-white sticky top-0 z-40">
            <div className="mx-auto max-w-7xl px-6 h-14 flex items-center gap-6">
              <Link href="/" className="font-semibold tracking-tight text-sm">
                RazorReclaim
              </Link>
              <nav className="flex items-center gap-4 text-sm text-neutral-600">
                <Link href="/" className="hover:text-neutral-900">
                  Dashboard
                </Link>
                <Link href="/approvals" className="hover:text-neutral-900">
                  Approval Queue
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <Toaster position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
