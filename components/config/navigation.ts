export interface NavigationItem {
  id: string;
  label: string;
  href: string;
}

export const navigation: NavigationItem[] = [
  {
    id: "command-center",
    label: "Command Center",
    href: "/",
  },
  {
    id: "apparatus",
    label: "Apparatus",
    href: "/apparatus",
  },
  {
    id: "personnel",
    label: "Personnel",
    href: "/personnel",
  },
  {
    id: "training",
    label: "Training",
    href: "/training",
  },
  {
    id: "certifications",
    label: "Certifications",
    href: "/certifications",
  },
  {
    id: "inventory",
    label: "Inventory",
    href: "/inventory",
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
  },
  {
    id: "calendar",
    label: "Calendar",
    href: "/calendar",
  },
  {
    id: "documents",
    label: "Documents",
    href: "/documents",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
  },
];