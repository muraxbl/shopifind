import { NextResponse, type NextRequest } from "next/server";
import {
  isSameOriginFormPost,
  isValidEmailTokenHash,
} from "@/lib/auth/magic-link";
import { safeAuthRedirectNext } from "@/lib/auth/redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  if (!isSameOriginFormPost(request.headers.get("origin"), url.origin)) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=magic_link_invalid", url.origin),
      303,
    );
  }

  const tokenHash = String(form.get("token_hash") ?? "").trim();
  const type = String(form.get("type") ?? "");
  const redirectTo = String(form.get("redirect_to") ?? "").slice(0, 2048);
  const next = safeAuthRedirectNext(redirectTo, url.origin, "/wishlist");

  if (type !== "email" || !isValidEmailTokenHash(tokenHash)) {
    return NextResponse.redirect(
      new URL("/login?error=magic_link_invalid", url.origin),
      303,
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=magic_link_invalid", url.origin),
      303,
    );
  }

  return NextResponse.redirect(new URL(next, url.origin), 303);
}
