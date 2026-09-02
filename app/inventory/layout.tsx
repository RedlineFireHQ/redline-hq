import type { ReactNode } from "react";
import PageLayout from "@/components/layout/PageLayout";

export default function InventoryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PageLayout
      environmentBackgroundUrl="/branding/images/inventorypage.png"
      environmentBackgroundPosition="left center"
    >
      <main className="min-h-screen bg-transparent px-6 py-10 text-white">
        {children}
      </main>
    </PageLayout>
  );
}
