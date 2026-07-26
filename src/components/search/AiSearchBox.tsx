'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'mochila impermeable ≤80€',
  'auriculares reparables',
  'alfombra artesanal <300€',
  'camiseta orgánica unisex',
];

export function AiSearchBox({ compact = false, initialValue }: { compact?: boolean; initialValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialValue ?? '');
  const [isPending, start] = useTransition();

  const submit = (query: string) => {
    const term = query.trim();
    if (!term) return;
    start(() => {
      router.push(`/search?q=${encodeURIComponent(term)}`);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(q);
      }}
      className={cn('relative w-full', compact && 'max-w-md')}
      role="search"
      aria-label="Buscar productos"
    >
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        <Search className="h-4 w-4" />
      </div>
      <Input
        type="search"
        placeholder="Busca con tus palabras, p.ej. “mochila sostenible <80€”"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="pl-9 pr-24"
        autoComplete="off"
      />
      <Button
        type="submit"
        size="sm"
        disabled={isPending || !q.trim()}
        className="absolute right-1 top-1/2 -translate-y-1/2 gap-1"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {isPending ? 'Buscando…' : 'AI'}
      </Button>

      {!compact && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground animate-fade-in"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
