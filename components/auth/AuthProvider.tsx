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

type AuthContextValue = {
	session: Session | null;
	user: User | null;
	member: MemberProfile | null;
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
	const [isLoading, setIsLoading] = useState(true);

	async function loadMemberByEmail(email: string | null | undefined) {
		const normalizedEmail = email?.trim();

		if (!normalizedEmail) {
			setMember(null);
			return;
		}

		const { data, error } = await supabase
			.from("members")
			.select("*")
			.eq("email", normalizedEmail)
			.maybeSingle();

		if (error) {
			console.error("[auth] loadMemberByEmail error", {
				email: normalizedEmail,
				error,
			});
			setMember(null);
			return;
		}

		setMember((data as MemberProfile | null) ?? null);
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
			await loadMemberByEmail(currentSession?.user?.email);
			setIsLoading(false);
		}

		void bootstrapSession();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
			setSession(nextSession);
			setUser(nextSession?.user ?? null);
			await loadMemberByEmail(nextSession?.user?.email);
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
			await loadMemberByEmail(data.user?.email);
		}

		return { error };
	}

	async function signOut() {
		const { error } = await supabase.auth.signOut();

		if (!error) {
			setSession(null);
			setUser(null);
			setMember(null);
		}

		return { error };
	}

	async function refreshSession() {
		const {
			data: { session: refreshedSession },
		} = await supabase.auth.getSession();

		setSession(refreshedSession);
		setUser(refreshedSession?.user ?? null);
		await loadMemberByEmail(refreshedSession?.user?.email);
	}

	const value = useMemo<AuthContextValue>(
		() => ({
			session,
			user,
			member,
			isLoading,
			signInWithPassword,
			signOut,
			refreshSession,
		}),
		[session, user, member, isLoading],
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
