import { notFound } from "next/navigation";
import PediatricBagPreviewDetail from "@/components/inventory/PediatricBagPreviewDetail";
import {
  countUnresolvedPreviewItems,
  getPreviewBag,
  getPreviewSections,
} from "@/lib/pediatric-bags/preview";

interface PediatricBagPreviewDetailProps {
  params: Promise<{ label: string }>;
}

export default async function PediatricBagPreviewDetailPage({ params }: PediatricBagPreviewDetailProps) {
  const { label } = await params;
  const bag = getPreviewBag(label);

  if (!bag) {
    notFound();
  }

  return (
    <PediatricBagPreviewDetail
      bag={bag}
      sections={getPreviewSections()}
      unresolvedCount={countUnresolvedPreviewItems()}
    />
  );
}
