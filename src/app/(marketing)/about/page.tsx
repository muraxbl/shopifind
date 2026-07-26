import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SITE_CONFIG } from '@/lib/config';

export default function AboutPage() {
  return (
    <div className="container py-16">
      <h1 className="font-display text-4xl">Sobre Shopifind</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        {SITE_CONFIG.tagline} {SITE_CONFIG.description}
      </p>

      <section className="prose prose-stone mt-10 max-w-3xl">
        <h2>Misión</h2>
        <p>
          Hacer que descubrir tiendas independientes sea tan fácil como buscar en Amazon — pero
          para productos que valen la pena conocer y marcas que valen la pena apoyar.
        </p>

        <h2>Qué es (y qué no)</h2>
        <p>
          Shopifind es un metabuscador y curador. No vendemos productos, no tenemos inventario, no
          almacenamos envíos. Cuando haces click en un producto, completas la compra en la tienda
          original. Si usamos un link de afiliado, ganamos una pequeña comisión que mantiene este
          servicio — sin que a ti te cueste nada extra.
        </p>

        <h2>Criterios de curación</h2>
        <ul>
          <li>Tamaño D2C / independiente (excluimos marketplaces agregadores).</li>
          <li>Programa de afiliado o feed verificable (para mantener precios actualizados).</li>
          <li>Posicionamiento diferenciado (sostenible, local, indie, ético, artesanal).</li>
        </ul>
      </section>

      <div className="mt-12">
        <Button asChild>
          <Link href="/explore/sustainable-fashion">Empieza a explorar</Link>
        </Button>
      </div>
    </div>
  );
}
