import { NextResponse } from "next/server";
import { accountExportFilename, readAllAccountRows } from "@/lib/account/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }

  const [
    profileResult,
    wishlistResult,
    alertsResult,
    deliveriesResult,
    searchesResult,
  ] = await Promise.all([
    sb
      .from("users")
      .select(
        "full_name, avatar_url, plan, niche_prefs, created_at, updated_at",
      )
      .eq("id", user.id)
      .maybeSingle(),
    sb
      .from("wishlists")
      .select("items, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    readAllAccountRows((from, to) =>
      sb
        .from("price_alerts")
        .select(
          "id, product_id, mode, baseline_price_cents, baseline_currency, target_price_cents, percentage_drop, active, last_evaluated_history_id, last_notified_price_cents, last_notified_at, created_at, updated_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    readAllAccountRows((from, to) =>
      sb
        .from("price_alert_deliveries")
        .select(
          "id, alert_id, price_history_id, reference_price_cents, reference_currency, status, provider_message_id, error_message, attempt_count, created_at, attempted_at, sent_at",
        )
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    readAllAccountRows((from, to) =>
      sb
        .from("search_history")
        .select("id, query, filters, results_count, created_at")
        .eq("user_id", user.id)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const queryFailed =
    profileResult.error ||
    wishlistResult.error ||
    !alertsResult.success ||
    !deliveriesResult.success ||
    !searchesResult.success;
  if (queryFailed) {
    const exportTooLarge = [
      alertsResult,
      deliveriesResult,
      searchesResult,
    ].some((result) => !result.success && result.error === "too_large");
    console.error("[account-export] read failed", {
      profile: Boolean(profileResult.error),
      wishlist: Boolean(wishlistResult.error),
      alerts: alertsResult.success ? null : alertsResult.error,
      deliveries: deliveriesResult.success ? null : deliveriesResult.error,
      searches: searchesResult.success ? null : searchesResult.error,
    });
    return NextResponse.json(
      {
        ok: false,
        error: exportTooLarge ? "export_too_large" : "export_failed",
      },
      { status: exportTooLarge ? 413 : 503, headers: PRIVATE_HEADERS },
    );
  }

  const providers = Array.isArray(user.app_metadata.providers)
    ? user.app_metadata.providers
    : user.app_metadata.provider
      ? [user.app_metadata.provider]
      : [];
  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      createdAt: user.created_at,
      updatedAt: user.updated_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      providers,
      metadata: user.user_metadata,
      identities: (user.identities ?? []).map((identity) => ({
        id: identity.id,
        identityId: identity.identity_id,
        provider: identity.provider,
        createdAt: identity.created_at,
        updatedAt: identity.updated_at,
        lastSignInAt: identity.last_sign_in_at,
        data: identity.identity_data,
      })),
    },
    profile: profileResult.data,
    wishlist: wishlistResult.data,
    priceAlerts: alertsResult.data,
    priceAlertDeliveries: deliveriesResult.data,
    searchHistory: searchesResult.data,
  };

  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${accountExportFilename()}"`,
    },
  });
}
