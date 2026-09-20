export type QrResolvedObject = {
  type: "ems_supply" | "apparatus";
  id: string;
  label: string;
  value: string;
};

export function apparatusQrValue(apparatusId: string) {
  return `apparatus:${apparatusId}`;
}

export function parseApparatusQrValue(value: string) {
  const match = /^apparatus:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(value.trim());
  return match?.[1] ?? null;
}