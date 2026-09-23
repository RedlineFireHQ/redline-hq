import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function middleware(request: NextRequest) {
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
	const isPrivacyRoute = pathname === "/privacy";
	const isPublicRootRoute = pathname === "/";
	const isPublicDemoRequestRoute = pathname === "/api/demo-request";
	const isChangePasswordRoute = pathname === "/change-password";
	const mustChangePassword = user?.user_metadata?.must_change_password === true;

	if (!user && !isLoginRoute && !isPrivacyRoute && !isPublicRootRoute && !isPublicDemoRequestRoute) {
		const url = request.nextUrl.clone();
		url.pathname = "/login";
		url.search = "";
		return NextResponse.redirect(url);
	}

	if (user && mustChangePassword && !isChangePasswordRoute) {
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