import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckCircle2, LogOut, Settings2, UserRound } from 'lucide-react';
import { updateProfile, signOut } from '@/actions/profile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NICHE_LABEL, SITE_CONFIG, type NicheId } from '@/lib/config';
import { MAX_PROFILE_NAME_LENGTH } from '@/lib/profile/input';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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

const ERROR_MESSAGES: Record<string, string> = {
  invalid_name: `El nombre debe tener como máximo ${MAX_PROFILE_NAME_LENGTH} caracteres.`,
  invalid_niche: 'Alguna preferencia seleccionada no es válida.',
  save_failed: 'No hemos podido guardar el perfil. Inténtalo de nuevo.',
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: AccountSearchParams;
}) {
  const sb = createServerSupabaseClient();
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
  const selectedNiches = new Set(profile?.niche_prefs ?? []);
  const errorMessage = searchParams.error
    ? ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.save_failed
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

      {searchParams.saved && (
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
            <p className="truncate font-medium">{profile?.full_name || 'Tu cuenta Shopifind'}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
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
            <legend className="text-sm font-medium">Nichos que te interesan</legend>
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

      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5">
        <div>
          <p className="text-sm font-medium">Sesión actual</p>
          <p className="mt-1 text-xs text-muted-foreground">Cerrar sesión sólo en este dispositivo.</p>
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
