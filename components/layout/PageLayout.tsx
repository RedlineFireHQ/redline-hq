import { ReactNode } from "react";
import Sidebar from "@/components/command-center-v3/Sidebar";
import Header from "@/components/command-center-v3/Header";
import Footer from "@/components/command-center-v3/Footer";

interface PageLayoutProps {
  children: ReactNode;
}

export default function PageLayout({
  children,
}: PageLayoutProps) {
  return (
    <div className="h-screen overflow-hidden bg-neutral-950 text-white">
      <div className="flex h-screen">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header />

          <main className="flex-1 overflow-y-auto bg-neutral-950">
            <div className="w-full px-4 py-4 lg:px-6 xl:px-8">
              {children}
            </div>
          </main>

          <div className="border-t border-white/10 bg-neutral-950 px-4 lg:px-6 xl:px-8">
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}