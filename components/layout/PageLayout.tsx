import { ReactNode } from "react";
import Sidebar from "@/components/command-center-v3/Sidebar";
import Header from "@/components/command-center-v3/Header";
import Footer from "@/components/command-center-v3/Footer";

interface PageLayoutProps {
  children: ReactNode;
  environmentBackgroundUrl?: string;
  environmentBackgroundPosition?: string;
}

export default function PageLayout({
  children,
  environmentBackgroundUrl,
  environmentBackgroundPosition = "center center",
}: PageLayoutProps) {
  return (
    <div className="relative h-screen overflow-hidden bg-neutral-950 text-white">
      {environmentBackgroundUrl ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 bg-cover bg-no-repeat"
            style={{
              backgroundImage: `url(${environmentBackgroundUrl})`,
              backgroundPosition: environmentBackgroundPosition,
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(130%_92%_at_54%_50%,rgba(8,8,10,0.18)_0%,rgba(8,8,10,0.28)_42%,rgba(8,8,10,0.52)_100%),linear-gradient(to_bottom,rgba(5,6,8,0.18),rgba(5,6,8,0.36))]"
          />
        </>
      ) : null}

      <div className="flex h-screen min-h-0">
        <Sidebar translucent={Boolean(environmentBackgroundUrl)} />

        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          <Header translucent={Boolean(environmentBackgroundUrl)} />

          <main className={`min-h-0 flex-1 overflow-y-auto ${environmentBackgroundUrl ? "bg-transparent" : "bg-neutral-950"}`}>
            <div className="w-full px-4 py-4 lg:px-6 xl:px-8">
              {children}
            </div>
          </main>

          <div className="flex-shrink-0 border-t border-white/10 bg-neutral-950 px-4 lg:px-6 xl:px-8">
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}