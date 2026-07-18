"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "../config/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-neutral-800 bg-neutral-950 text-white">
      {/* Logo Area */}
      <div className="border-b border-neutral-800 p-6">
        <Link href="/">
          <h1 className="cursor-pointer text-3xl font-bold tracking-wide">
            <span className="text-red-600">REDLINE</span>{" "}
            <span className="text-white">HQ</span>
          </h1>
        </Link>

        <p className="mt-2 text-sm text-neutral-400">
          Less Paperwork.
          <br />
          More Readiness.
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const active = pathname === item.href;

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`block rounded-lg px-4 py-3 transition ${
                    active
                      ? "bg-red-600 text-white"
                      : "text-neutral-300 hover:bg-red-600 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-neutral-800 p-5">
        <p className="text-xs text-neutral-500">
          Redline HQ
          <br />
          Version 1.0
        </p>
      </div>
    </aside>
  );
}