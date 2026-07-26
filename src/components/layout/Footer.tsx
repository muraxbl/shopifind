import Link from 'next/link';
import { SITE_CONFIG, NICHE_LABEL, NicheId } from '@/lib/config';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/40">
      <div className="container py-12">
        {/* Legal disclaimer — prominent */}
        <div className="rounded-lg border border-border/60 bg-background/50 p-4 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Aviso legal —</strong>{' '}
          {SITE_CONFIG.legalDisclaimer}
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          <div>
            <div className="font-display text-xl text-primary">{SITE_CONFIG.name}</div>
            <p className="mt-2 text-sm text-muted-foreground">{SITE_CONFIG.tagline}</p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nichos
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {SITE_CONFIG.primaryNiches.map((n) => (
                <li key={n}>
                  <Link
                    href={`/explore/${n}`}
                    className="text-foreground/80 transition-colors hover:text-primary"
                  >
                    {NICHE_LABEL[n as NicheId].emoji} {NICHE_LABEL[n as NicheId].label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Shopifind
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-primary">Sobre nosotros</Link></li>
              <li><Link href="/legal" className="hover:text-primary">Aviso legal & afiliados</Link></li>
              <li><Link href="/privacy" className="hover:text-primary">Privacidad</Link></li>
              <li><Link href="/login" className="hover:text-primary">Iniciar sesión</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          © {year} Shopifind. Hecho con cuidado para compradores que prefieren tiendas reales.
        </div>
      </div>
    </footer>
  );
}
