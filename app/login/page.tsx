"use client";

import { Capacitor } from "@capacitor/core";
import Image from "next/image";
import { Lock, Mail } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

function getPostLoginDestination() {
	return Capacitor.isNativePlatform() || window.matchMedia("(max-width: 767px)").matches ? "/mobile" : "/";
}

function subscribeToHashChanges(callback: () => void) {
	window.addEventListener("hashchange", callback);
	return () => window.removeEventListener("hashchange", callback);
}

function hasUnverifiedEmailFragment() {
	const params = new URLSearchParams(window.location.hash.slice(1));
	return params.has("error") || params.has("access_token") || params.get("type") === "recovery";
}

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [infoMessage, setInfoMessage] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSendingReset, setIsSendingReset] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const { session, isLoading, signInWithPassword } = useAuth();
	const unverifiedEmailFragment = useSyncExternalStore(subscribeToHashChanges, hasUnverifiedEmailFragment, () => false);

	useEffect(() => {
		if (!isLoading && session) {
			router.replace(session.user.user_metadata?.must_change_password === true ? "/change-password?first=1" : getPostLoginDestination());
		}
	}, [isLoading, router, session]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setErrorMessage(null);
		setInfoMessage(null);
		setIsSubmitting(true);

		const { error } = await signInWithPassword({
			email: email.trim(),
			password,
		});

		if (error) {
			setErrorMessage(error.message || "Unable to sign in.");
			setIsSubmitting(false);
			return;
		}

		const {
			data: { user: signedInUser },
		} = await supabase.auth.getUser();
		const mustChangePassword = signedInUser?.user_metadata?.must_change_password === true;

		router.replace(mustChangePassword ? "/change-password?first=1" : getPostLoginDestination());
		router.refresh();
	}

	async function handleForgotPassword() {
		setErrorMessage(null);
		setInfoMessage(null);
		const normalizedEmail = email.trim();

		if (!normalizedEmail) {
			setErrorMessage("Enter your email address first to receive a reset link.");
			return;
		}

		setIsSendingReset(true);
		const redirectTo = `${window.location.origin}/auth/recovery`;
		const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
			redirectTo,
		});

		if (error) {
			setErrorMessage(error.message || "Unable to send password reset email.");
			setIsSendingReset(false);
			return;
		}

		setInfoMessage("Password reset email sent. Open the recovery link from your email to choose a new password.");
		setIsSendingReset(false);
	}

	return (
		<main className="min-h-screen bg-[#050608] text-white">
			<div className="grid min-h-screen lg:grid-cols-[1.4fr_0.96fr]">
				<section className="relative hidden overflow-hidden border-b border-white/10 bg-black lg:block lg:min-h-screen lg:border-b-0 lg:border-r lg:border-white/10">
					<Image
						src="/branding/images/redlineloginpage.png"
						alt="Firefighter standing in front of engine"
						fill
						priority
						className="object-cover"
						style={{ objectPosition: "calc(36% + 160px) center" }}
						sizes="(max-width: 1023px) 100vw, 58vw"
					/>
					<div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,4,6,0.1)_0%,rgba(3,4,6,0.14)_40%,rgba(3,4,6,0.58)_100%)]" />
					<div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.58)_100%)]" />
				</section>

				<section className="relative flex min-h-screen items-center bg-[#0a0c0f] px-6 py-10 sm:px-8 lg:min-h-screen lg:items-start lg:px-12 lg:py-12 xl:px-16 xl:py-14">
					<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.015)_0%,rgba(255,255,255,0)_18%),radial-gradient(circle_at_top,rgba(239,43,45,0.06),transparent_30%)]" />
					<div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_28%)]" />
					<div className="relative z-10 mx-auto w-full max-w-[460px]">
						<div className="mb-8 sm:mb-10 lg:mt-4">
							<div className="relative mx-auto h-[126px] w-[270px] max-w-full sm:h-[152px] sm:w-[340px] lg:ml-[50px] lg:h-[166px] lg:w-[372px]">
								<Image
								src="/branding/images/redlinesidebarlogo.png"
									alt="Redline HQ"
									fill
									priority
									className="object-contain object-center lg:object-left"
									sizes="(max-width: 640px) 270px, (max-width: 1023px) 340px, 372px"
								/>
							</div>
						</div>

						<div className="pt-2 lg:pt-4">
							<div className="mb-8">
								<h1 className="text-[2.1rem] font-semibold tracking-tight text-white sm:text-[3.1rem] lg:text-[3.3rem]">
									Welcome Back
								</h1>
								<p className="mt-2 text-[1.15rem] leading-7 text-zinc-400">
									Sign in to your department
								</p>
							</div>

							<form className="space-y-5" onSubmit={handleSubmit}>
								<div>
									<label htmlFor="email" className="text-sm font-medium text-zinc-200">
										Email
									</label>
									<div className="relative mt-2">
										<Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
										<input
											id="email"
											type="email"
											autoComplete="email"
											value={email}
											onChange={(event) => setEmail(event.target.value)}
											placeholder="you@department.com"
											className="h-[58px] w-full rounded-xl border border-white/12 bg-[#111418] pl-12 pr-4 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-[#ef2b2d]"
											required
										/>
									</div>
								</div>

								<div>
									<label htmlFor="password" className="text-sm font-medium text-zinc-200">
										Password
									</label>
									<div className="relative mt-2">
										<Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
										<input
											id="password"
											type={showPassword ? "text" : "password"}
											autoComplete="current-password"
											value={password}
											onChange={(event) => setPassword(event.target.value)}
											placeholder="Enter your password"
											className="h-[58px] w-full rounded-xl border border-white/12 bg-[#111418] pl-12 pr-14 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-[#ef2b2d]"
											required
										/>
										<button
											type="button"
											onClick={() => setShowPassword((current) => !current)}
											className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-zinc-400 transition hover:text-white"
											aria-label={showPassword ? "Hide password" : "Show password"}
										>
											{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
										</button>
									</div>
								</div>

								{errorMessage || unverifiedEmailFragment ? (
									<div className="rounded-2xl border border-red-500/35 bg-red-500/12 px-4 py-3 text-sm text-red-100">
										{errorMessage || "This email link could not be verified. Request a new password reset link, or ask your administrator for a new invitation."}
									</div>
								) : null}

								{infoMessage ? (
									<div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
										{infoMessage}
									</div>
								) : null}

								<button
									type="submit"
									disabled={isSubmitting}
									className="flex h-[58px] w-full items-center justify-center rounded-xl bg-[#ef2b2d] text-[1.05rem] font-semibold uppercase tracking-[0.05em] text-white transition hover:bg-[#ff383a] disabled:cursor-not-allowed disabled:opacity-60"
								>
									{isSubmitting ? "Signing In..." : "Sign In"}
								</button>

								<div className="flex items-center justify-between gap-4 pt-1 text-sm text-zinc-400">
									<button
										type="button"
										onClick={handleForgotPassword}
										disabled={isSendingReset}
										className="font-medium text-zinc-300 underline decoration-white/25 underline-offset-4 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
									>
										{isSendingReset ? "Sending reset link..." : "Forgot password?"}
									</button>
								</div>
							</form>
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}