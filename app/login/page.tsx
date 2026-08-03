"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isReady, setIsReady] = useState(false);
	const { session, isLoading, signInWithPassword } = useAuth();

	useEffect(() => {
		if (!isLoading && session) {
			router.replace("/");
		}
	}, [isLoading, router, session]);

	useEffect(() => {
		const animationFrame = window.requestAnimationFrame(() => {
			setIsReady(true);
		});

		return () => {
			window.cancelAnimationFrame(animationFrame);
		};
	}, []);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setErrorMessage(null);
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

		router.replace("/");
		router.refresh();
	}

	return (
		<div className="relative min-h-screen overflow-hidden text-white">
			<div
				className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
				style={{
					backgroundImage: "url('/branding-images/redline-hq-login-hero-v1.png')",
				}}
			/>
			<div
				className="fixed inset-0 -z-10"
				style={{
					background:
						"linear-gradient(90deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.65) 100%)",
				}}
			/>

			<div className="relative flex min-h-screen items-center justify-center px-6 py-8 lg:justify-end lg:px-10 xl:px-16">
				<div
					className={`w-full max-w-[460px] rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(10,10,10,0.48)] px-12 py-[38px] shadow-[0_16px_38px_rgba(0,0,0,0.30)] backdrop-blur-2xl transition-opacity duration-200 ease-out lg:translate-x-12 ${
						isReady ? "opacity-100" : "opacity-0"
					}`}
				>
					<div className="mb-7">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
							Redline HQ
						</p>
						<p className="mt-2 text-xs text-zinc-500">Less Paperwork. More Readiness.</p>
					</div>

					<div className="text-left">
						<h1 className="text-4xl font-black leading-tight tracking-tight text-white lg:text-[44px]">
							Protect readiness before the tones drop.
						</h1>
						<p className="mt-5 text-base leading-7 text-zinc-200">
							Sign in to access your department&apos;s Command Center, apparatus readiness, training, certifications, and operational workflows.
						</p>
					</div>

					<form className="mt-8 space-y-5" onSubmit={handleSubmit}>
						<div>
							<label htmlFor="email" className="text-sm font-semibold text-zinc-200">
								Email
							</label>
							<input
								id="email"
								type="email"
								autoComplete="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								placeholder="name@department.org"
								className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-[rgba(15,15,15,0.9)] px-4 text-base text-white outline-none transition duration-200 placeholder:text-zinc-500 focus:border-[#E11D2E]"
								required
							/>
						</div>

						<div>
							<label htmlFor="password" className="text-sm font-semibold text-zinc-200">
								Password
							</label>
							<input
								id="password"
								type="password"
								autoComplete="current-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								placeholder="Enter your password"
								className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-[rgba(15,15,15,0.9)] px-4 text-base text-white outline-none transition duration-200 placeholder:text-zinc-500 focus:border-[#E11D2E]"
								required
							/>
						</div>

						{errorMessage ? (
							<div className="rounded-2xl border border-red-500/35 bg-red-500/12 px-4 py-3 text-sm text-red-100">
								{errorMessage}
							</div>
						) : null}

						<button
							type="submit"
							disabled={isSubmitting || isLoading}
							className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#E11D2E] text-base font-bold text-white shadow-[0_8px_16px_rgba(225,29,46,0.18)] transition duration-150 hover:-translate-y-0.5 hover:bg-[#f13342] disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isSubmitting || isLoading ? "Signing in..." : "Enter Command Center"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}