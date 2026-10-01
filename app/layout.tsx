import type { Metadata } from "next";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import AuthProvider from "@/components/auth/AuthProvider";
import NativeStartupRedirect from "@/components/layout/NativeStartupRedirect";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redline HQ",
  description: "Fire Department Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className="min-h-screen bg-neutral-950 text-white"
        style={{ fontFamily: '"Space Grotesk", sans-serif' }}
      >
        <AuthProvider>
          <NativeStartupRedirect />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}