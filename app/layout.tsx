import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import AuthProvider from "@/components/auth/AuthProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

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
        className={`${spaceGrotesk.className} min-h-screen bg-neutral-950 text-white`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}