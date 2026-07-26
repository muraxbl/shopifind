import { SITE_CONFIG } from '@/lib/config';

export default function LegalPage() {
  return (
    <div className="container py-16">
      <h1 className="font-display text-4xl">Aviso legal y afiliados</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: hoy</p>

      <div className="prose prose-stone mt-8 max-w-3xl">
        <h2>1. Sobre Shopifind</h2>
        <p>
          <strong>Shopifind</strong> es una plataforma independiente de descubrimiento de productos.
          No vendemos, fabricamos ni distribuimos ningún producto indexado. Cuando un comprador
          visita una tienda enlazada desde Shopifind, está entrando en una web gestionada
          íntegramente por esa tienda.
        </p>

        <h2>2. Aviso sobre la marca "Shopify"</h2>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <strong>Aviso importante:</strong> {SITE_CONFIG.legalDisclaimer}
          <br />
          Este aviso se publica de buena fe para evitar cualquier confusión con la marca registrada
          Shopify Inc. Si eres representante de Shopify Inc. y deseas revisar este contenido,
          escríbenos a <a href="mailto:legal@shopifind.com">legal@shopifind.com</a>.
        </div>

        <h2>3. Programa de afiliados (FTC / UE disclosure)</h2>
        <p>
          Shopifind participa en programas de afiliación con merchants y plataformas como
          Skimlinks, ShareASale y Awin. Cuando recomendamos un producto y haces click en su enlace,
          puede que recibamos una pequeña comisión si completas una compra —{' '}
          <strong>sin coste adicional para ti</strong>. Esto nos permite mantener el servicio,
          seguir curando y mejorar la búsqueda con IA.
        </p>
        <p>
          Las recomendaciones siempre son independientes y priorizamos relevancia, calidad
          percibida y valores del merchant. La comisión recibida no influye en el posicionamiento
          del producto en el catálogo.
        </p>

        <h2>4. Propiedad intelectual</h2>
        <p>
          Los logotipos, marcas y nombres de productos pertenecen a sus respectivos titulares y se
          usan en Shopifind únicamente con fines informativos y de discovery.
        </p>

        <h2>5. Limitación de responsabilidad</h2>
        <p>
          Shopifind no se hace responsable de la calidad, envío, devolución o garantía de los
          productos adquiridos en las tiendas enlazadas; esas responsabilidades corresponden al
          merchant cuya página visites.
        </p>

        <h2>6. Contacto</h2>
        <p>
          Para consultas legales, reclamaciones o retirada de listings:&nbsp;
          <a href="mailto:legal@shopifind.com">legal@shopifind.com</a>.
        </p>
      </div>
    </div>
  );
}
