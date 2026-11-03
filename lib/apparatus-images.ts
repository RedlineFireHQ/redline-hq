const ELLIOTT_IMAGES: Record<string, string> = {
  "engine 430": "/apparatus/elliott/pumper-430.jpg",
  "engine 432": "/apparatus/elliott/pumper-432.jpg",
  "grass truck 420": "/apparatus/elliott/brush-420.jpg",
  "grass truck 421": "/apparatus/elliott/brush-421.jpg",
  "tanker 445": "/apparatus/elliott/tanker-445.jpg",
};

const CEDAR_BLUFF_IMAGES: Record<string, string> = {
  "engine 1": "/apparatus/cedarbluff/engine-1.jpg",
  "engine 2": "/apparatus/cedarbluff/engine-2.jpg",
  "tanker 1": "/apparatus/cedarbluff/tanker-1.jpg",
  "brush 1": "/apparatus/cedarbluff/brush-1.jpg",
  "rescue 1": "/apparatus/cedarbluff/rescue-1.jpg",
  "medic 1": "/apparatus/cedarbluff/medic-1.jpg",
};

const RED_OAK_IMAGES: Record<string, string> = {
  "114": "/apparatus/redoak/114.jpg",
  "115": "/apparatus/redoak/115.jpg",
  "116": "/apparatus/redoak/116.jpg",
  "117": "/apparatus/redoak/117.jpg",
  "120": "/apparatus/redoak/120.jpg",
  "121": "/apparatus/redoak/121.jpg",
  "130": "/apparatus/redoak/130.jpg",
  "131": "/apparatus/redoak/131.jpg",
  "135": "/apparatus/redoak/135Fire%20Truck,%20Flag,%20and%20Fireworks.png",
  "140": "/apparatus/redoak/140.jpg",
  "141": "/apparatus/redoak/141.jpg",
  "142": "/apparatus/redoak/142.PNG",
  "145": "/apparatus/redoak/145.jpg",
  "rofd ranger": "/apparatus/redoak/Ranger.PNG",
  "special operations trailer": "/apparatus/redoak/Specialops.PNG",
  "daily apparatus checks": "/apparatus/redoak/Daily%20Apparatus%20Checks%20at%20Red%20Oak%20Firehouse.png",
  "station generator": "/apparatus/redoak/station-generator.jpg",
};

const DEPARTMENT_IMAGES = new Map<string, Record<string, string>>([
  ["339028ba-a3d9-4f16-9ee4-80be662fb9ee", ELLIOTT_IMAGES],
  ["4d811b72-1857-4cf4-93b5-9cbbd889153f", ELLIOTT_IMAGES],
  ["44a25960-7d46-45c4-94e9-115833072da8", CEDAR_BLUFF_IMAGES],
  ["82f50d14-216a-4dd1-80f4-58459dc97b97", RED_OAK_IMAGES],
]);

type ApparatusImageSource = {
  name: string | null;
  department_id: string | null;
};

export function getApparatusImagePath(
  apparatus: ApparatusImageSource | null | undefined,
  departmentId: string | null | undefined,
): string | null {
  if (!departmentId || apparatus?.department_id !== departmentId || !apparatus.name) {
    return null;
  }

  const images = DEPARTMENT_IMAGES.get(departmentId);
  if (!images) {
    return null;
  }

  const normalizedName = apparatus.name.trim().toLowerCase();
  const canonicalName = normalizedName.replace(/[^a-z0-9]+/g, " ").trim();

  if (!canonicalName) {
    return null;
  }

  const exactMatch = Object.hasOwn(images, normalizedName)
    ? images[normalizedName]
    : Object.hasOwn(images, canonicalName) ? images[canonicalName] : null;

  if (exactMatch) {
    return exactMatch;
  }

  // Preserve Elliott's existing unit-number aliases only within Elliott departments.
  if (images !== ELLIOTT_IMAGES) {
    return null;
  }

  const has430 = /\b430\b/.test(canonicalName);
  const has432 = /\b432\b/.test(canonicalName);
  const has420 = /\b420\b/.test(canonicalName);
  const has421 = /\b421\b/.test(canonicalName);
  const has445 = /\b445\b/.test(canonicalName);

  if ((canonicalName.includes("engine") || canonicalName.includes("pumper")) && has430) {
    return images["engine 430"];
  }

  if ((canonicalName.includes("engine") || canonicalName.includes("pumper")) && has432) {
    return images["engine 432"];
  }

  if ((canonicalName.includes("grass") || canonicalName.includes("brush") || canonicalName.includes("truck")) && has420) {
    return images["grass truck 420"];
  }

  if ((canonicalName.includes("grass") || canonicalName.includes("brush") || canonicalName.includes("truck")) && has421) {
    return images["grass truck 421"];
  }

  if (canonicalName.includes("tanker") && has445) {
    return images["tanker 445"];
  }

  if (has430) {
    return images["engine 430"];
  }

  if (has432) {
    return images["engine 432"];
  }

  if (has420) {
    return images["grass truck 420"];
  }

  if (has421) {
    return images["grass truck 421"];
  }

  if (has445) {
    return images["tanker 445"];
  }

  return null;
}
