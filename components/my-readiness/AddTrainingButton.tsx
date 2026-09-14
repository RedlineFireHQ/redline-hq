"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SubmitTrainingModal from "@/components/training/SubmitTrainingModal";

type TrainingCategoryRow = {
  id: string;
  name: string;
  active: boolean;
};

type EmsCourseDefinitionRow = {
  id: string;
  course_name: string;
  active: boolean;
};

interface AddTrainingButtonProps {
  departmentId: string;
  currentMemberId: string;
  categories: TrainingCategoryRow[];
  emsCourseDefinitions: EmsCourseDefinitionRow[];
}

export default function AddTrainingButton({
  departmentId,
  currentMemberId,
  categories,
  emsCourseDefinitions,
}: AddTrainingButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
      >
        Add Training
      </button>

      <SubmitTrainingModal
        variant="modal"
        open={isOpen}
        onClose={() => setIsOpen(false)}
        departmentId={departmentId}
        currentMemberId={currentMemberId}
        categories={categories}
        emsCourseDefinitions={emsCourseDefinitions}
        onSubmitted={() => {
          setIsOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
