import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirect";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Send a Supabase magic-link email. Triggered by the login form submit.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=invalid_form", url.origin),
      303,
    );
  }
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = safeNextPath(
    form.get("next")?.toString() ?? url.searchParams.get("next"),
    "/",
  );

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_email", url.origin),
      303,
    );
  }

  const supabase = await createServerSupabaseClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${baseUrl}/api/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=magic_link_send_failed", url.origin),
      303,
    );
  }

  return NextResponse.redirect(new URL("/login?sent=1", url.origin), 303);
}
