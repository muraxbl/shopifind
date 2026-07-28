import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink, GitCompareArrows } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildCompareHref,
  MIN_COMPARE_PRODUCTS,
  parseCompareIds,
} from "@/lib/compare/selection";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Comparar productos",
  description: "Compara los productos que has seleccionado en Shopifind.",
  robots: { index: false, follow: false },
};

type CompareProduct = {
  id: string;
  slug: string;
  title: string;
  image_url: string;
  price_cents: number;
  currency: string;
  store_name: string;
  store_slug: string;
  store_eco_score: number;
  niche: string;
  eco_tags: string[];
  in_stock: boolean;
  attributes: unknown;
};

const ATTRIBUTE_ROWS = [
  { label: "Potencia", keys: ["potencia", "wattage"] },
  { label: "Lúmenes", keys: ["lumens"] },
  {
    label: "Temperatura de color",
    keys: ["temperatura_color", "color_temp"],
  },
  { label: "Casquillo", keys: ["casquillo"] },
  { label: "Ángulo de apertura", keys: ["angulo_apertura"] },
  { label: "Material", keys: ["material"] },
  { label: "Protección", keys: ["grado_proteccion"] },
  { label: "Garantía", keys: ["garantia"] },
  { label: "Vida útil", keys: ["horas_vida"] },
  { label: "Certificaciones", keys: ["certificaciones"] },
] as const;

function attributeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value.trim() || "—";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return "—";
}

function displayAttribute(
  product: CompareProduct,
  keys: readonly string[],
): string {
  const attributes = attributeRecord(product.attributes);
  for (const key of keys) {
    const value = displayValue(attributes[key]);
    if (value !== "—") return value;
  }
  return "—";
}

function EmptyComparison() {
  return (
    <div className="container flex min-h-[60vh] max-w-xl flex-col items-center justify-center py-12 text-center">
      <GitCompareArrows className="h-12 w-12 text-muted-foreground" />
      <h1 className="mt-4 font-display text-3xl">
        Selecciona al menos dos productos
      </h1>
      <p className="mt-2 text-muted-foreground">
        Haz una búsqueda y marca entre dos y cinco cards para compararlas lado a
        lado.
      </p>
      <Button asChild className="mt-6">
        <Link href="/search">Ir al buscador</Link>
      </Button>
    </div>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { ids?: string | string[] };
}) {
  const ids = parseCompareIds(searchParams.ids);
  if (ids.length < MIN_COMPARE_PRODUCTS) return <EmptyComparison />;

  const sb = createServerSupabaseClient();
  const { data, error } = await sb
    .from("v_products_with_store")
    .select(
      "id, slug, title, image_url, price_cents, currency, store_name, store_slug, store_eco_score, niche, eco_tags, in_stock, attributes",
    )
    .in("id", ids)
    .eq("in_stock", true);

  if (error) console.error("[compare] products read failed:", error.message);
  const unordered = (data ?? []) as CompareProduct[];
  const products = ids
    .map((id) => unordered.find((product) => product.id === id))
    .filter((product): product is CompareProduct => Boolean(product));
  if (products.length < MIN_COMPARE_PRODUCTS) return <EmptyComparison />;

  const oneCurrency =
    new Set(products.map((product) => product.currency)).size === 1;
  const bestPrice = oneCurrency
    ? Math.min(...products.map((product) => product.price_cents))
    : null;
  const bestEco = Math.max(
    ...products.map((product) => product.store_eco_score),
  );
  const attributeRows = ATTRIBUTE_ROWS.filter((row) =>
    products.some((product) => displayAttribute(product, row.keys) !== "—"),
  ).slice(0, 8);

  return (
    <div className="container py-10 md:py-14">
      <Link
        href="/search"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a resultados
      </Link>
      <header className="mb-8 mt-5">
        <Badge variant="eco" className="mb-3 inline-flex gap-1">
          <GitCompareArrows className="h-3 w-3" /> Comparación manual
        </Badge>
        <h1 className="font-display text-3xl md:text-4xl">
          Tus productos seleccionados
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Comparamos los artículos que has elegido. Pueden ser alternativas
          distintas; Shopifind no afirma que sean el mismo modelo.
        </p>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Los botones &quot;Ver en tienda&quot; son enlaces afiliados: podemos
          recibir una comisión si compras, sin coste adicional para ti.{' '}
          <Link href="/legal" className="underline">
            Más información
          </Link>
          .
        </p>
      </header>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-40 min-w-40 border-b bg-card p-4 text-left align-bottom text-xs uppercase tracking-wide text-muted-foreground"
              >
                Producto
              </th>
              {products.map((product) => (
                <th
                  key={product.id}
                  scope="col"
                  className="w-60 min-w-60 border-b border-l p-4 text-left align-top font-normal"
                >
                  <Link
                    href={`/product/${product.slug}`}
                    className="group block"
                  >
                    <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-secondary/50">
                      <Image
                        src={product.image_url}
                        alt={product.title}
                        fill
                        sizes="240px"
                        className="object-cover transition-transform group-hover:scale-[1.03]"
                      />
                    </div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {product.store_name}
                    </span>
                    <span className="mt-1 line-clamp-3 block font-display text-base leading-tight group-hover:text-primary">
                      {product.title}
                    </span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b bg-card p-4 text-left font-medium"
              >
                Precio
              </th>
              {products.map((product) => (
                <td
                  key={product.id}
                  className={cn(
                    "border-b border-l p-4 font-display text-lg",
                    bestPrice !== null &&
                      product.price_cents === bestPrice &&
                      "bg-emerald-50 text-emerald-800",
                  )}
                >
                  {formatPrice(product.price_cents, product.currency)}
                  {bestPrice !== null && product.price_cents === bestPrice && (
                    <span className="ml-2 text-[10px] font-sans uppercase">
                      Mejor precio
                    </span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b bg-card p-4 text-left font-medium"
              >
                Eco-score de tienda
              </th>
              {products.map((product) => (
                <td
                  key={product.id}
                  className={cn(
                    "border-b border-l p-4",
                    product.store_eco_score === bestEco &&
                      "bg-emerald-50 text-emerald-800",
                  )}
                >
                  {product.store_eco_score}/100
                  {product.store_eco_score === bestEco && (
                    <span className="ml-2 text-[10px] uppercase">
                      Mejor score
                    </span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b bg-card p-4 text-left font-medium"
              >
                Etiquetas
              </th>
              {products.map((product) => (
                <td key={product.id} className="border-b border-l p-4">
                  <div className="flex max-w-52 flex-wrap gap-1">
                    {product.eco_tags.slice(0, 5).map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                    {product.eco_tags.length === 0 && "—"}
                  </div>
                </td>
              ))}
            </tr>
            {attributeRows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b bg-card p-4 text-left font-medium"
                >
                  {row.label}
                </th>
                {products.map((product) => (
                  <td
                    key={product.id}
                    className="border-b border-l p-4 text-muted-foreground"
                  >
                    {displayAttribute(product, row.keys)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-card p-4 text-left font-medium"
              >
                Comprar
              </th>
              {products.map((product) => (
                <td key={product.id} className="border-l p-4">
                  <Button asChild className="w-full gap-2">
                    <a
                      href={`/go/${product.slug}`}
                      rel="nofollow sponsored noopener noreferrer"
                    >
                      Ver en {product.store_name}{" "}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {products.map((product) => {
          const remaining = ids.filter((id) => id !== product.id);
          return (
            <Button key={product.id} asChild variant="outline" size="sm">
              <Link href={buildCompareHref(remaining)}>
                Quitar {product.store_name}
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
