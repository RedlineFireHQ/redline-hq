"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function LogoutButton() {
	const router = useRouter();
	const [isSigningOut, setIsSigningOut] = useState(false);
	const { signOut } = useAuth();

	async function handleLogout() {
		setIsSigningOut(true);

		const { error } = await signOut();

		if (error) {
			setIsSigningOut(false);
			return;
		}

		router.replace("/login");
		router.refresh();
	}

	return (
		<button
			type="button"
			onClick={handleLogout}
			disabled={isSigningOut}
			className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition hover:border-[#EF2B2D] hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-60"
		>
			<LogOut className="h-4 w-4" />
			{isSigningOut ? "Signing out..." : "Logout"}
		</button>
	);
}