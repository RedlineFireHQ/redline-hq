export const DEPARTMENT_DOCUMENTS_CATEGORY = "Department Documents";
export const MISCELLANEOUS_DOCUMENTS_CATEGORY_NAME = "Miscellaneous Documents";
export const MISCELLANEOUS_DOCUMENTS_CATEGORY_SLUG = "miscellaneous-documents";

export type DocumentSourceKind = "library" | "pre_plan" | "personnel_qualification" | "training";

export type DocumentReferenceCategoryRow = {
  id: string;
  department_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "active" | "archived";
  is_default: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export function slugifyDocumentReferenceCategoryName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || MISCELLANEOUS_DOCUMENTS_CATEGORY_SLUG;
}