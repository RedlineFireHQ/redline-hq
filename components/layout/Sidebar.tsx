"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const items = [
    { label: "Command Center", href: "/" },
    { label: "Apparatus", href: "/apparatus" },
    { label: "Personnel", href: "/personnel" },
    { label: "Training", href: "/training" },
    { label: "Deficiencies", href: "/deficiencies" },
    { label: "Assets", href: "/assets" },
    { label: "Reports", href: "/reports" },
    { label: "Documents", href: "/documents" },
    { label: "Settings", href: "/settings" },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-neutral-800 bg-neutral-950 text-white">
      {/* Logo */}
      <div className="border-b border-neutral-800 px-6 py-7">
        <h1 className="text-2xl font-bold tracking-wide text-red-500">
          REDLINE HQ
        </h1>

        <p className="mt-2 text-sm text-neutral-400">
          Elliott Fire Department
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5">
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className={`block w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
                  isActive(item.href)
                    ? "bg-red-600 text-white"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User */}
      <div className="border-t border-neutral-800 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 font-bold">
            A
          </div>

          <div>
            <p className="font-semibold text-white">
              Adam Smith
            </p>

            <p className="text-xs text-neutral-500">
              Administrator
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}