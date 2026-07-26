import Link from 'next/link';
import { Chrome, Github, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SITE_CONFIG } from '@/lib/config';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string; sent?: string };
}) {
  const next = searchParams.next ?? '/wishlist';
  const oauthUrl = (provider: string) =>
    `/api/auth/oauth/${provider}?next=${encodeURIComponent(next)}`;

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl">Bienvenida/o</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Inicia sesión para guardar tu wishlist, recibir alertas y personalizar tus nichos.
        </p>

        {searchParams.error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {searchParams.error}
          </div>
        )}
        {searchParams.sent && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Te hemos enviado un magic link a <strong>{searchParams.sent}</strong>. Revisa tu bandeja.
          </div>
        )}

        <div className="mt-8 space-y-3">
          <Button asChild variant="outline" className="w-full justify-start gap-2">
            <a href={oauthUrl('google')}>
              <Chrome className="h-4 w-4" /> Continuar con Google
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start gap-2">
            <a href={oauthUrl('github')}>
              <Github className="h-4 w-4" /> Continuar con GitHub
            </a>
          </Button>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            o con email
            <div className="h-px flex-1 bg-border" />
          </div>

          <form
            action={`/api/auth/magic-link?next=${encodeURIComponent(next)}`}
            method="POST"
            className="space-y-2"
          >
            <label className="block">
              <span className="text-xs text-muted-foreground">Email</span>
              <Input type="email" name="email" placeholder="tu@correo.com" required />
            </label>
            <Button type="submit" className="w-full gap-2">
              <Mail className="h-4 w-4" />
              Enviar magic link
            </Button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Al continuar aceptas nuestros{' '}
          <Link href="/legal" className="underline hover:text-primary">términos</Link> y{' '}
          <Link href="/privacy" className="underline hover:text-primary">política de privacidad</Link>.
        </p>
        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          {SITE_CONFIG.legalDisclaimer}
        </p>
      </div>
    </div>
  );
}
