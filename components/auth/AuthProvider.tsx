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
	useState,
} from "react";
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
	}) => Promise<{ error: AuthError | null }>;
	signOut: () => Promise<{ error: AuthError | null }>;
	refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export default function AuthProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [member, setMember] = useState<MemberProfile | null>(null);
	const [department, setDepartment] = useState<DepartmentProfile | null>(null);
	const [permissions, setPermissions] = useState<MemberPermissions>({
		personnel_management: false,
		reports_management: false,
	});
	const [isLoading, setIsLoading] = useState(true);

	async function loadMemberProfileByIdentity(userCandidate: User | null | undefined) {
		if (!userCandidate) {
			setMember(null);
			setDepartment(null);
			setPermissions({ personnel_management: false, reports_management: false });
			return;
		}

		// Resolve the current member server-side. The active department lives in an
		// httpOnly cookie that client JavaScript cannot read, and a user can belong to
		// multiple departments — so an ambiguous client-side maybeSingle() on
		// auth_user_id can pick the wrong member row (wrong role/nav). The server route
		// resolves the member for the active department authoritatively.
		try {
			const response = await fetch("/api/auth/current-member", { cache: "no-store" });
			const result = (await response.json().catch(() => null)) as {
				ok?: boolean;
				member?: MemberProfile | null;
				department?: DepartmentProfile | null;
				permissions?: MemberPermissions;
			} | null;

			if (!response.ok || !result?.ok) {
				setMember(null);
				setDepartment(null);
				setPermissions({ personnel_management: false, reports_management: false });
				return;
			}

			setMember(result.member ?? null);
			setDepartment(result.department ?? null);
			setPermissions({
				personnel_management: Boolean(result.permissions?.personnel_management),
				reports_management: Boolean(result.permissions?.reports_management),
			});
		} catch (error) {
			console.error("[auth] loadMemberProfileByIdentity error", error);
			setMember(null);
			setDepartment(null);
			setPermissions({ personnel_management: false, reports_management: false });
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
			await loadMemberProfileByIdentity(currentSession?.user);
			setIsLoading(false);
		}

		void bootstrapSession();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
			setSession(nextSession);
			setUser(nextSession?.user ?? null);
			await loadMemberProfileByIdentity(nextSession?.user);
			setIsLoading(false);
		});

		return () => {
			isMounted = false;
			subscription.unsubscribe();
		};
	}, []);

	async function signInWithPassword(credentials: {
		email: string;
		password: string;
	}) {
		console.log("[auth] signInWithPassword request", {
			email: credentials.email,
			passwordLength: credentials.password.length,
		});

		const { data, error } = await supabase.auth.signInWithPassword(credentials);

		console.log("[auth] signInWithPassword response", {
			data,
			error,
		});

		if (!error) {
			setSession(data.session);
			setUser(data.user ?? null);
			await loadMemberProfileByIdentity(data.user);
		}

		return { error };
	}

	async function signOut() {
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

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);

	if (!context) {
		throw new Error("useAuth must be used within AuthProvider.");
	}

	return context;
}
