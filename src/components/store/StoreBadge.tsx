import Link from "next/link";
import { BadgeCheck, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatEcoScore, cn } from "@/lib/utils";

export interface StoreBadgeProps {
  store: {
    slug: string;
    name: string;
    short_description: string | null;
    eco_score: number;
    values: string[];
    country: string | null;
    featured: boolean;
    verified: boolean;
  };
}

export function StoreBadge({ store }: StoreBadgeProps) {
  const eco = formatEcoScore(store.eco_score);
  return (
    <Link
      href={`/store/${store.slug}`}
      className={cn(
        "group flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-5 transition-all",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-base text-foreground">
            <span className="inline-flex items-center gap-1">
              {store.name}
              {store.verified && (
                <BadgeCheck
                  className="h-4 w-4 text-primary"
                  aria-label="Verified"
                />
              )}
            </span>
          </div>
          {store.country && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" /> {store.country}
            </div>
          )}
        </div>
        {store.featured && <Badge variant="eco">Featured</Badge>}
      </div>

      {store.short_description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {store.short_description}
        </p>
      )}

      <div className="mt-1 flex flex-wrap gap-1">
        {store.values.slice(0, 4).map((v) => (
          <span
            key={v}
            className="rounded-md bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
          >
            {v}
          </span>
        ))}
      </div>

      <div className="mt-1 text-xs">
        <span
          className={cn(
            "inline-block rounded-full px-2 py-0.5 font-medium",
            eco.variant,
          )}
        >
          {eco.evaluated
            ? `Eco-score ${store.eco_score}/100`
            : "Sin evaluación eco"}
        </span>
      </div>
    </Link>
  );
}
