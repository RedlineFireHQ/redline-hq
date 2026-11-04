import type { NextResponse } from "next/server";

export const activeDepartmentCookieName = "redline_active_department_id";

export function setActiveDepartmentCookie(response: NextResponse, departmentId: string) {
  response.cookies.set(activeDepartmentCookieName, departmentId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: departmentId ? 60 * 60 * 24 * 365 : 0,
  });
}
