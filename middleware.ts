import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function middleware(request: NextRequest) {
	if (request.nextUrl.pathname === "/auth/invite" || request.nextUrl.pathname === "/auth/recovery" || request.nextUrl.pathname === "/api/cron/notification-emails") {
		return NextResponse.next({ request });
	}

	// Exchange older PKCE recovery links before authenticated-login redirects.
	if (request.nextUrl.pathname === "/login" && (request.nextUrl.searchParams.has("code") || request.nextUrl.searchParams.has("error"))) {
		const url = request.nextUrl.clone();
		url.pathname = "/auth/recovery";
		return NextResponse.redirect(url, {
			headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
		});
	}

	let response = NextResponse.next({
		request,
	});

	const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

				response = NextResponse.next({
					request,
				});

				cookiesToSet.forEach(({ name, value, options }) => {
					response.cookies.set(name, value, options);
				});
			},
		},
	});

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { pathname } = request.nextUrl;
	const isLoginRoute = pathname === "/login";
	const isDeleteAccountRoute = pathname === "/delete-account";
	const isPrivacyRoute = pathname === "/privacy";
	const isPublicRootRoute = pathname === "/";
	const isPublicDemoRequestRoute = pathname === "/api/demo-request";
	const isChangePasswordRoute = pathname === "/change-password";
	const isAuthContextRoute = pathname === "/api/auth/current-member" || pathname === "/api/auth/set-active-department";
	const isClearDepartmentRoute = pathname === "/api/auth/current-member" && request.method === "DELETE";
	const mustChangePassword = user?.user_metadata?.must_change_password === true;

	if (!user && !isLoginRoute && !isDeleteAccountRoute && !isPrivacyRoute && !isPublicRootRoute && !isPublicDemoRequestRoute && !isClearDepartmentRoute) {
		const url = request.nextUrl.clone();
		url.pathname = "/login";
		url.search = "";
		return NextResponse.redirect(url);
	}

	if (user && mustChangePassword && !isChangePasswordRoute && !isAuthContextRoute) {
		const url = request.nextUrl.clone();
		url.pathname = "/change-password";
		url.search = "?first=1";
		return NextResponse.redirect(url);
	}

	if (user && isLoginRoute) {
		const url = request.nextUrl.clone();
		url.pathname = mustChangePassword ? "/change-password" : "/";
		url.search = mustChangePassword ? "?first=1" : "";
		return NextResponse.redirect(url);
	}

	return response;
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};