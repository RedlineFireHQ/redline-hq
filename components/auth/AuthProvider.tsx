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

type AuthContextValue = {
	session: Session | null;
	user: User | null;
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
	const [isLoading, setIsLoading] = useState(true);

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
			setIsLoading(false);
		}

		void bootstrapSession();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, nextSession) => {
			setSession(nextSession);
			setUser(nextSession?.user ?? null);
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
		const { data, error } = await supabase.auth.signInWithPassword(credentials);

		if (!error) {
			setSession(data.session);
			setUser(data.user ?? null);
		}

		return { error };
	}

	async function signOut() {
		const { error } = await supabase.auth.signOut();

		if (!error) {
			setSession(null);
			setUser(null);
		}

		return { error };
	}

	async function refreshSession() {
		const {
			data: { session: refreshedSession },
		} = await supabase.auth.getSession();

		setSession(refreshedSession);
		setUser(refreshedSession?.user ?? null);
	}

	const value = useMemo<AuthContextValue>(
		() => ({
			session,
			user,
			isLoading,
			signInWithPassword,
			signOut,
			refreshSession,
		}),
		[session, user, isLoading],
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
