import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DesignMe Client Portal",
  description: "Your project with DesignMe: onboarding, brief, progress and feedback in one place.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
            <span className="text-lg font-semibold tracking-tight">
              DesignMe<span className="text-accent">.</span>
            </span>
            <span className="text-sm text-muted">Client Portal</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
        <footer className="py-8 text-center text-xs text-muted">
          Questions? Message us in your shared Slack channel or email hello@designme.agency
        </footer>
      </body>
    </html>
  );
}
