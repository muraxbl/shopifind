'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Check, GitCompareArrows, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildCompareHref,
  MAX_COMPARE_PRODUCTS,
  MIN_COMPARE_PRODUCTS,
} from '@/lib/compare/selection';
import { cn } from '@/lib/utils';

type CompareSelectionContextValue = {
  selectedIds: string[];
  toggle: (productId: string) => void;
  clear: () => void;
};

const CompareSelectionContext =
  createContext<CompareSelectionContextValue | null>(null);

export function CompareSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = useCallback((productId: string) => {
    setSelectedIds((current) => {
      if (current.includes(productId))
        return current.filter((id) => id !== productId);
      if (current.length >= MAX_COMPARE_PRODUCTS) return current;
      return [...current, productId];
    });
  }, []);
  const clear = useCallback(() => setSelectedIds([]), []);
  const value = useMemo(
    () => ({ selectedIds, toggle, clear }),
    [selectedIds, toggle, clear],
  );
  const ready = selectedIds.length >= MIN_COMPARE_PRODUCTS;

  return (
    <CompareSelectionContext.Provider value={value}>
      {children}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border bg-background/95 p-3 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className="text-sm font-medium">
                {selectedIds.length} de {MAX_COMPARE_PRODUCTS} seleccionados
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {ready
                  ? 'Compara los productos lado a lado.'
                  : 'Selecciona al menos un producto más.'}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clear}
              aria-label="Limpiar comparación"
            >
              <X className="h-4 w-4" />
            </Button>
            {ready ? (
              <Button asChild className="gap-2">
                <Link href={buildCompareHref(selectedIds)}>
                  <GitCompareArrows className="h-4 w-4" /> Comparar
                </Link>
              </Button>
            ) : (
              <Button disabled className="gap-2">
                <GitCompareArrows className="h-4 w-4" /> Comparar
              </Button>
            )}
          </div>
        </div>
      )}
    </CompareSelectionContext.Provider>
  );
}

export function CompareToggle({ productId }: { productId: string }) {
  const context = useContext(CompareSelectionContext);
  if (!context) return null;

  const selected = context.selectedIds.includes(productId);
  const atLimit = context.selectedIds.length >= MAX_COMPARE_PRODUCTS;
  const disabled = atLimit && !selected;

  return (
    <button
      type="button"
      aria-label={
        selected ? 'Quitar de la comparación' : 'Añadir a la comparación'
      }
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => context.toggle(productId)}
      title={disabled ? `Máximo ${MAX_COMPARE_PRODUCTS} productos` : undefined}
      className={cn(
        'absolute left-3 top-3 z-20 inline-flex h-9 items-center gap-1.5 rounded-full border bg-background/90 px-2.5 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50',
        selected &&
          'border-primary bg-primary text-primary-foreground hover:text-primary-foreground',
      )}
    >
      {selected ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <GitCompareArrows className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">Comparar</span>
    </button>
  );
}
