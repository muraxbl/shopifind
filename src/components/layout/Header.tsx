import Link from 'next/link';
import { Heart, Search, User } from 'lucide-react';
import { SITE_CONFIG, NICHE_LABEL, NicheId } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { AiSearchBox } from '@/components/search/AiSearchBox';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-primary">
            Shopifind
          </span>
          <span className="hidden text-xs uppercase tracking-widest text-muted-foreground sm:inline">
            indie · curated
          </span>
        </Link>

        {/* Inline search (≥ md) */}
        <div className="hidden flex-1 max-w-md md:block">
          <AiSearchBox compact />
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {SITE_CONFIG.primaryNiches.map((n) => (
            <Link
              key={n}
              href={`/explore/${n}`}
              className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:inline-block"
            >
              {NICHE_LABEL[n as NicheId].emoji} {NICHE_LABEL[n as NicheId].label}
            </Link>
          ))}
          <Link
            href="/wishlist"
            className="hidden rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:inline-block"
            aria-label="Wishlist"
          >
            <Heart className="h-5 w-5" />
          </Link>
          <Link
            href="/login"
            className="hidden rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:inline-block"
            aria-label="Account"
          >
            <User className="h-5 w-5" />
          </Link>
          <Link href="/search" className="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden">
            <Search className="h-5 w-5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
