import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import {
  ACCENT_BOOT_SCRIPT,
  AccentProvider,
} from "@/components/providers/accent-provider";
import {
  THEME_BOOT_SCRIPT,
  ThemeProvider,
} from "@/components/providers/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tembo Agent Studio",
  description: "Self-hosted control plane for running and governing agents.",
  // Default icon for non-workspace pages (login, onboarding). Workspace
  // routes override this in their layout's generateMetadata with the
  // workspace's chosen favicon. We deliberately ship no app/favicon.ico:
  // that file convention injects a competing `/favicon.ico` <link> on
  // every page that the browser preferred over the workspace icon.
  icons: {
    icon: "/favicons/default-tembo.svg",
    shortcut: "/favicons/default-tembo.svg",
    apple: "/favicons/default-tembo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Restore theme + accent before body parses so first paint
            matches the user's chosen mode and surface tint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AccentProvider>{children}</AccentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
