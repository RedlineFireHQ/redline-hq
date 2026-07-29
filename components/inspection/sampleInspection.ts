export interface InspectionItem {
  id: number;
  label: string;
}

export const sampleInspection: InspectionItem[] = [
  {
    id: 1,
    label: "Oil Level Checked",
  },
  {
    id: 2,
    label: "Coolant Level Checked",
  },
  {
    id: 3,
    label: "Emergency Lights Operational",
  },
  {
    id: 4,
    label: "Tires Visually Inspected",
  },
];