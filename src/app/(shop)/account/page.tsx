import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  CheckCircle2,
  Download,
  LogOut,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { deleteAccount } from '@/actions/account';
import { updateProfile, signOut } from '@/actions/profile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NICHE_LABEL, SITE_CONFIG, type NicheId } from '@/lib/config';
import { MAX_PROFILE_NAME_LENGTH } from '@/lib/profile/input';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  PriceAlertList,
  type AccountPriceAlert,
} from '@/components/account/PriceAlertList';
import type { PriceAlertMode } from '@/lib/alerts/input';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mi cuenta',
  robots: { index: false, follow: false },
};

type AccountSearchParams = {
  saved?: string;
  error?: string;
};

type ProfileRow = {
  full_name: string | null;
  plan: 'free' | 'plus' | 'pro';
  niche_prefs: string[];
};

type AlertRow = {
  product_id: string;
  mode: PriceAlertMode;
  baseline_currency: string;
  target_price_cents: number | null;
  percentage_drop: number | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_name: `El nombre debe tener como máximo ${MAX_PROFILE_NAME_LENGTH} caracteres.`,
  invalid_niche: 'Alguna preferencia seleccionada no es válida.',
  save_failed: 'No hemos podido guardar el perfil. Inténtalo de nuevo.',
  delete_confirmation:
    'Para eliminar la cuenta debes escribir exactamente el email de acceso.',
  delete_failed:
    'No hemos podido eliminar la cuenta. No se ha cerrado la sesión; inténtalo de nuevo.',
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<AccountSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect('/login?next=/account');

  const { data } = await sb
    .from('users')
    .select('full_name, plan, niche_prefs')
    .eq('id', user.id)
    .maybeSingle();
  const profile = data as ProfileRow | null;
  const alertResult = await sb
    .from('price_alerts')
    .select(
      'product_id, mode, baseline_currency, target_price_cents, percentage_drop',
    )
    .eq('user_id', user.id)
    .eq('active', true)
    .order('updated_at', { ascending: false });
  const alertRows = (alertResult.data ?? []) as AlertRow[];
  const alertProductIds = alertRows.map((alert) => alert.product_id);
  const alertProductsResult = alertProductIds.length
    ? await sb
        .from('v_products_with_store')
        .select('id, slug, title, price_cents, currency')
        .in('id', alertProductIds)
    : { data: [], error: null };
  const alertProducts = (alertProductsResult.data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    price_cents: number;
    currency: string;
  }>;
  const accountAlerts: AccountPriceAlert[] = alertRows.map((alert) => {
    const product = alertProducts.find(
      (candidate) => candidate.id === alert.product_id,
    );
    return {
      productId: alert.product_id,
      productSlug: product?.slug ?? null,
      productTitle: product?.title ?? 'Producto no disponible',
      alertCurrency: alert.baseline_currency,
      currentCurrency: product?.currency ?? null,
      currentPriceCents: product?.price_cents ?? null,
      mode: alert.mode,
      targetPriceCents: alert.target_price_cents,
      percentageDrop: alert.percentage_drop,
    };
  });
  const selectedNiches = new Set(profile?.niche_prefs ?? []);
  const errorMessage = resolvedSearchParams.error
    ? (ERROR_MESSAGES[resolvedSearchParams.error] ?? ERROR_MESSAGES.save_failed)
    : null;

  return (
    <div className="container max-w-3xl py-10 md:py-14">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="eco" className="mb-3 inline-flex gap-1">
            <Settings2 className="h-3 w-3" /> Cuenta
          </Badge>
          <h1 className="font-display text-3xl md:text-4xl">Tu perfil</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Personaliza lo que quieres descubrir y gestiona tu sesión.
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          Plan {profile?.plan ?? 'free'}
        </Badge>
      </header>

      {resolvedSearchParams.saved && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="h-4 w-4" /> Perfil guardado.
        </div>
      )}
      {errorMessage && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {errorMessage}
        </div>
      )}

      <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">
              {profile?.full_name || 'Tu cuenta Shopifind'}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>

        <form action={updateProfile} className="space-y-7">
          <label className="block">
            <span className="text-sm font-medium">Nombre</span>
            <Input
              className="mt-2"
              name="full_name"
              defaultValue={profile?.full_name ?? ''}
              maxLength={MAX_PROFILE_NAME_LENGTH}
              autoComplete="name"
              placeholder="Cómo quieres que te llamemos"
            />
          </label>

          <fieldset>
            <legend className="text-sm font-medium">
              Nichos que te interesan
            </legend>
            <p className="mt-1 text-xs text-muted-foreground">
              Los usaremos para personalizar recomendaciones futuras.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {SITE_CONFIG.primaryNiches.map((niche) => {
                const item = NICHE_LABEL[niche as NicheId];
                return (
                  <label
                    key={niche}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-accent/60"
                  >
                    <input
                      type="checkbox"
                      name="niche_prefs"
                      value={niche}
                      defaultChecked={selectedNiches.has(niche)}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {item.emoji} {item.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.tagline}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Button type="submit">Guardar perfil</Button>
        </form>
      </section>

      <PriceAlertList
        available={!alertResult.error && !alertProductsResult.error}
        initialAlerts={accountAlerts}
      />

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm md:p-7">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl">Tus datos y privacidad</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Descarga una copia en JSON de tu perfil, wishlist, búsquedas y
              alertas.
            </p>
          </div>
        </div>

        <Button asChild variant="outline" className="mt-5 gap-2">
          <a href="/api/account/export" download>
            <Download className="h-4 w-4" /> Descargar mis datos
          </a>
        </Button>

        <details className="mt-6 border-t pt-5">
          <summary className="cursor-pointer text-sm font-medium text-rose-700">
            Eliminar mi cuenta definitivamente
          </summary>
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
            <p>
              Esta acción elimina tu acceso, perfil, wishlist, búsquedas
              asociadas, alertas y su historial de entregas. No se puede
              deshacer.
            </p>
            <form action={deleteAccount} className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs">
                  Escribe <strong>{user.email}</strong> para confirmar
                </span>
                <Input
                  className="mt-2 border-rose-300 bg-white"
                  type="email"
                  name="confirmation"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </label>
              <Button
                type="submit"
                variant="outline"
                className="gap-2 border-rose-300 bg-white text-rose-700 hover:bg-rose-100 hover:text-rose-800"
              >
                <Trash2 className="h-4 w-4" /> Eliminar cuenta
              </Button>
            </form>
          </div>
        </details>
      </section>

      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5">
        <div>
          <p className="text-sm font-medium">Sesión actual</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cerrar sesión sólo en este dispositivo.
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="gap-2">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </Button>
        </form>
      </section>
    </div>
  );
}
