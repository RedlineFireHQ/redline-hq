const APPARATUS_IMAGE_BY_NAME: Record<string, string> = {
  "engine 430": "/apparatus/elliott/pumper-430.jpg",
  "engine 432": "/apparatus/elliott/pumper-432.jpg",
  "grass truck 420": "/apparatus/elliott/brush-420.jpg",
  "grass truck 421": "/apparatus/elliott/brush-421.jpg",
  "tanker 445": "/apparatus/elliott/tanker-445.jpg",
};

export function getApparatusImagePath(apparatusName: string | null | undefined): string | null {
  if (!apparatusName) {
    return null;
  }

  const normalizedName = apparatusName.trim().toLowerCase();
  const canonicalName = normalizedName.replace(/[^a-z0-9]+/g, " ").trim();

  if (!canonicalName) {
    return null;
  }

  const exactMatch = APPARATUS_IMAGE_BY_NAME[normalizedName] ?? APPARATUS_IMAGE_BY_NAME[canonicalName];

  if (exactMatch) {
    return exactMatch;
  }

  const has430 = /\b430\b/.test(canonicalName);
  const has432 = /\b432\b/.test(canonicalName);
  const has420 = /\b420\b/.test(canonicalName);
  const has421 = /\b421\b/.test(canonicalName);
  const has445 = /\b445\b/.test(canonicalName);

  if ((canonicalName.includes("engine") || canonicalName.includes("pumper")) && has430) {
    return APPARATUS_IMAGE_BY_NAME["engine 430"];
  }

  if ((canonicalName.includes("engine") || canonicalName.includes("pumper")) && has432) {
    return APPARATUS_IMAGE_BY_NAME["engine 432"];
  }

  if ((canonicalName.includes("grass") || canonicalName.includes("brush") || canonicalName.includes("truck")) && has420) {
    return APPARATUS_IMAGE_BY_NAME["grass truck 420"];
  }

  if ((canonicalName.includes("grass") || canonicalName.includes("brush") || canonicalName.includes("truck")) && has421) {
    return APPARATUS_IMAGE_BY_NAME["grass truck 421"];
  }

  if (canonicalName.includes("tanker") && has445) {
    return APPARATUS_IMAGE_BY_NAME["tanker 445"];
  }

  if (has430) {
    return APPARATUS_IMAGE_BY_NAME["engine 430"];
  }

  if (has432) {
    return APPARATUS_IMAGE_BY_NAME["engine 432"];
  }

  if (has420) {
    return APPARATUS_IMAGE_BY_NAME["grass truck 420"];
  }

  if (has421) {
    return APPARATUS_IMAGE_BY_NAME["grass truck 421"];
  }

  if (has445) {
    return APPARATUS_IMAGE_BY_NAME["tanker 445"];
  }

  return null;
}
