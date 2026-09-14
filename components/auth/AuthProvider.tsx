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
		const authUserId = typeof userCandidate?.id === "string" ? userCandidate.id : "";
		const normalizedEmail = userCandidate?.email?.trim();

		if (!authUserId && !normalizedEmail) {
			setMember(null);
			setDepartment(null);
			setPermissions({ personnel_management: false, reports_management: false });
			return;
		}

		let data: MemberProfile | null = null;
		let error: unknown = null;

		if (authUserId) {
			const authUserLookup = await supabase
				.from("members")
				.select("*")
				.eq("auth_user_id", authUserId)
				.maybeSingle();

			data = (authUserLookup.data as MemberProfile | null) ?? null;
			error = authUserLookup.error;
		}

		if (!data && normalizedEmail) {
			const emailFallbackLookup = await supabase
				.from("members")
				.select("*")
				.eq("email", normalizedEmail)
				.maybeSingle();

			data = (emailFallbackLookup.data as MemberProfile | null) ?? null;
			error = emailFallbackLookup.error;
		}

		if (error) {
			console.error("[auth] loadMemberProfileByIdentity error", {
				authUserId,
				email: normalizedEmail,
				error,
			});
			setMember(null);
			setDepartment(null);
			setPermissions({ personnel_management: false, reports_management: false });
			return;
		}

		setMember(data ?? null);

		const departmentId = typeof data?.department_id === "string" ? data.department_id : "";
		if (!departmentId) {
			setDepartment(null);
			setPermissions({ personnel_management: false, reports_management: false });
			return;
		}

		const [personnelResult, reportsResult, departmentResult] = await Promise.all([
			supabase.rpc("member_has_app_permission", {
				p_department_id: departmentId,
				p_permission_key: "personnel_management",
			}),
			supabase.rpc("member_has_app_permission", {
				p_department_id: departmentId,
				p_permission_key: "reports_management",
			}),
			supabase.from("departments").select("id, name").eq("id", departmentId).maybeSingle(),
		]);

		setPermissions({
			personnel_management:
				!personnelResult.error && Boolean(personnelResult.data),
			reports_management:
				!reportsResult.error && Boolean(reportsResult.data),
		});

		const departmentName =
			typeof departmentResult.data?.name === "string" ? departmentResult.data.name : "";
		setDepartment(
			!departmentResult.error && departmentName ? { id: departmentId, name: departmentName } : null,
		);
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
