"use client";

import {
	type AuthError,
	type Session,
	type User,
} from "@supabase/supabase-js";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MemberProfile = {
	id: string;
	email: string | null;
	department_id: string | null;
	first_name: string | null;
	last_name: string | null;
	name: string | null;
	role: string | null;
	[key: string]: unknown;
};

type DepartmentProfile = {
	id: string;
	name: string;
};

type MemberPermissions = {
	personnel_management: boolean;
	reports_management: boolean;
};

type AuthContextValue = {
	session: Session | null;
	user: User | null;
	member: MemberProfile | null;
	department: DepartmentProfile | null;
	permissions: MemberPermissions;
	isLoading: boolean;
	signInWithPassword: (credentials: {
		email: string;
		password: string;
	}) => Promise<{ error: AuthError | Error | null }>;
	signOut: () => Promise<{ error: AuthError | Error | null }>;
	refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function clearDepartmentSelection() {
	const response = await fetch("/api/auth/current-member", { method: "DELETE" });
	if (!response.ok) throw new Error("Unable to clear department selection. Please retry signing out.");
}

export default function AuthProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [member, setMember] = useState<MemberProfile | null>(null);
	const [department, setDepartment] = useState<DepartmentProfile | null>(null);
	const [permissions, setPermissions] = useState<MemberPermissions>({
		personnel_management: false,
		reports_management: false,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [departmentOptions, setDepartmentOptions] = useState<DepartmentProfile[]>([]);
	const [contextError, setContextError] = useState<string | null>(null);
	const profileRequest = useRef(0);
	const profileFetch = useRef<AbortController | null>(null);
	const profileUserId = useRef<string | null>(null);

	function cancelProfileRequest() {
		++profileRequest.current;
		profileFetch.current?.abort();
	}

	async function loadMemberProfileByIdentity(userCandidate: User | null | undefined) {
		const requestId = ++profileRequest.current;
		profileFetch.current?.abort();
		profileFetch.current = null;
		if (profileUserId.current !== (userCandidate?.id ?? null)) {
			setMember(null);
			setDepartment(null);
			setPermissions({ personnel_management: false, reports_management: false });
			profileUserId.current = userCandidate?.id ?? null;
		}
		setDepartmentOptions([]);
		setContextError(null);
		if (!userCandidate) {
			setMember(null);
			setDepartment(null);
			setPermissions({ personnel_management: false, reports_management: false });
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		const controller = new AbortController();
		profileFetch.current = controller;

		// Resolve the current member server-side. The active department lives in an
		// httpOnly cookie that client JavaScript cannot read, and a user can belong to
		// multiple departments — so an ambiguous client-side maybeSingle() on
		// auth_user_id can pick the wrong member row (wrong role/nav). The server route
		// resolves the member for the active department authoritatively.
		try {
			const response = await fetch("/api/auth/current-member", { cache: "no-store", signal: controller.signal });
			const result = (await response.json().catch(() => null)) as {
				ok?: boolean;
				member?: MemberProfile | null;
				department?: DepartmentProfile | null;
				permissions?: MemberPermissions;
				selectionRequired?: boolean;
				departments?: DepartmentProfile[];
				error?: string;
			} | null;

			if (requestId !== profileRequest.current) return;
			if (!response.ok || !result?.ok) {
				setMember(null);
				setDepartment(null);
				setPermissions({ personnel_management: false, reports_management: false });
				if (response.status === 409 && result?.selectionRequired) {
					if (!result.departments?.length) throw new Error("No departments are available for selection.");
					setDepartmentOptions(result.departments);
					return;
				}
				if (response.status !== 401) {
					throw new Error(result?.error || "Unable to load department context.");
				}
				return;
			}

			setMember(result.member ?? null);
			setDepartment(result.department ?? null);
			setPermissions({
				personnel_management: Boolean(result.permissions?.personnel_management),
				reports_management: Boolean(result.permissions?.reports_management),
			});
		} catch (error) {
			if (requestId !== profileRequest.current) return;
			console.error("[auth] loadMemberProfileByIdentity error", error);
			setMember(null);
			setDepartment(null);
			setPermissions({ personnel_management: false, reports_management: false });
			setContextError(error instanceof Error ? error.message : "Unable to load department context.");
			throw error;
		} finally {
			if (requestId === profileRequest.current) setIsLoading(false);
		}
	}

	useEffect(() => {
		let isMounted = true;

		async function bootstrapSession() {
			const {
				data: { session: currentSession },
			} = await supabase.auth.getSession();

			if (!isMounted) {
				return;
			}

			setSession(currentSession);
			setUser(currentSession?.user ?? null);
			await loadMemberProfileByIdentity(currentSession?.user).catch((error: unknown) => {
				console.error("[auth] bootstrap department context failed", error);
			});
		}

		void bootstrapSession();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, nextSession) => {
			setSession(nextSession);
			setUser(nextSession?.user ?? null);
			if (event === "SIGNED_OUT") {
				await loadMemberProfileByIdentity(null);
				await clearDepartmentSelection().catch((error: unknown) => {
					console.error("[auth] clearDepartmentSelection error", error);
					setContextError(error instanceof Error ? error.message : "Unable to clear department selection.");
				});
				return;
			}
			await loadMemberProfileByIdentity(nextSession?.user).catch((error: unknown) => {
				console.error("[auth] updated department context failed", error);
			});
		});

		return () => {
			isMounted = false;
			cancelProfileRequest();
			subscription.unsubscribe();
		};
	}, []);

	async function signInWithPassword(credentials: {
		email: string;
		password: string;
	}) {
		const { data, error } = await supabase.auth.signInWithPassword(credentials);

		if (!error) {
			setSession(data.session);
			setUser(data.user ?? null);
			try {
				await loadMemberProfileByIdentity(data.user);
			} catch (contextFailure) {
				return { error: contextFailure instanceof Error ? contextFailure : new Error("Unable to load department context.") };
			}
		}

		return { error };
	}

	async function signOut() {
		cancelProfileRequest();
		try {
			await clearDepartmentSelection();
		} catch (error) {
			return { error: error instanceof Error ? error : new Error("Unable to clear department selection.") };
		}
		const { error } = await supabase.auth.signOut();

		if (!error) {
			setSession(null);
			setUser(null);
			setMember(null);
			setDepartment(null);
			setPermissions({ personnel_management: false, reports_management: false });
		}

		return { error };
	}

	async function selectDepartment(departmentId: string) {
		setIsLoading(true);
		setContextError(null);
		try {
			const response = await fetch("/api/auth/set-active-department", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ departmentId }),
			});
			const result = await response.json() as { ok?: boolean; error?: string };
			if (!response.ok || !result.ok) throw new Error(result.error || "Unable to select department.");
			await refreshSession();
			router.refresh();
		} catch (error) {
			setContextError(error instanceof Error ? error.message : "Unable to select department.");
		} finally {
			setIsLoading(false);
		}
	}

	async function refreshSession() {
		const {
			data: { user: refreshedUser },
		} = await supabase.auth.getUser();
		const {
			data: { session: refreshedSession },
		} = await supabase.auth.getSession();

		setSession(refreshedSession);
		setUser(refreshedUser ?? refreshedSession?.user ?? null);
		await loadMemberProfileByIdentity(refreshedUser ?? refreshedSession?.user);
	}

	const value = useMemo<AuthContextValue>(
		() => ({
			session,
			user,
			member,
			department,
			permissions,
			isLoading,
			signInWithPassword,
			signOut,
			refreshSession,
		}),
		[session, user, member, department, permissions, isLoading],
	);

	return <AuthContext.Provider value={value}>
		{session && ((isLoading && !member) || departmentOptions.length > 0 || contextError) ? (
			<main className="flex min-h-screen items-center justify-center bg-[#050608] p-6 text-white">
				<section className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#111111] p-6">
					<h1 className="text-xl font-semibold">{departmentOptions.length ? "Select Department" : "Loading department"}</h1>
					{departmentOptions.map((option) => (
						<button key={option.id} type="button" disabled={isLoading}
							onClick={() => void selectDepartment(option.id)}
							className="block w-full rounded-xl border border-white/20 p-3 text-left disabled:opacity-50">
							{option.name}
						</button>
					))}
					{contextError ? <>
						<p role="alert" className="text-sm text-red-300">{contextError}</p>
						<button type="button" disabled={isLoading} onClick={() => void refreshSession().catch((error: unknown) => {
							console.error("[auth] department context retry failed", error);
						})}>Retry</button>
					</> : null}
					{!isLoading ? <button type="button" onClick={() => void signOut().then(({ error }) => {
						if (error) setContextError(error.message);
						else { router.replace("/login"); router.refresh(); }
					})}>Sign out</button> : null}
				</section>
			</main>
		) : children}
	</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);

	if (!context) {
		throw new Error("useAuth must be used within AuthProvider.");
	}

	return context;
}
