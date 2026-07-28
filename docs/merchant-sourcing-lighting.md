# Segundo merchant de iluminación — spike de sourcing

> Fecha: 2026-07-28. Este documento evalúa fuentes públicas; no autoriza scraping, republicación, onboarding ni contacto comercial.

## Decisión recomendada

Priorizar **GreenIce** para la validación comercial y contractual. Mantener **Barcelona LED** como segunda opción. No ingestar ninguno hasta completar los dos gates del owner:

1. confirmar en el dashboard de Skimlinks que el dominio concreto está monetizable para Shopifind, admite deep links y opera en los mercados objetivo;
2. conseguir un feed autorizado o permiso explícito para indexar y refrescar datos de producto, incluidas imágenes y descripciones.

Que un endpoint sea público y rastreable no equivale a permiso para republicar su contenido.

## Evidencia técnica observada

| Candidato | Catálogo ES observado | Fuente pública | Calidad útil | Riesgos / dudas |
|---|---:|---|---|---|
| GreenIce | 3.572 productos en el snapshot | Shopify `products.json` + sitemap | SKU en 4.952 variantes, precio, stock, imágenes y títulos técnicos densos | Afiliación y licencia de feed no verificables públicamente; taxonomía `PRODUCTO` poco útil; cero SKU exactos compartidos con Masterled |
| Barcelona LED | 3.480 entradas en el sitemap principal | Shopify `products.json` + sitemap | SKU, variantes, precio, stock y catálogo de diseño/LED | Algún precio cero en la muestra; tags y tipos inconsistentes; afiliación/licencia sin verificar |
| efectoLED (antes Ledkia) | No cuantificado | PDP y sitemap propietario | Fichas técnicas ricas | El antiguo dominio redirige; no se encontró un endpoint estructurado equivalente en este spike y eleva el coste de mantenimiento |

Fuentes del merchant: [GreenIce](https://greenice.com/), [quiénes somos de GreenIce](https://greenice.com/pages/quienes-somos), [Barcelona LED](https://www.barcelonaled.com/es-es), [quiénes somos de Barcelona LED](https://www.barcelonaled.com/es-es/pages/quienes-somos) y [efectoLED](https://www.efectoled.com/es/).

Los recuentos son snapshots técnicos, no promesas de cobertura: Shopify incluye productos sin stock, variantes y mercados localizados de forma distinta. Se contó únicamente el sitemap del mercado principal para evitar duplicados por idioma.

## Viabilidad del matching

Se compararon en memoria, sin persistir ni importar datos:

- 1.563 filas válidas del feed temporal de Masterled;
- 3.572 productos y 4.952 variantes con SKU de GreenIce;
- coincidencias exactas entre `referencia_variante` de Masterled y SKU de GreenIce: **0**;
- coincidencias con una firma técnica amplia (tipo de producto + combinaciones de W, casquillo, K o IP): **66**.

Las 66 son sólo candidatos. La muestra incluye falsos positivos evidentes: un downlight y su driver pueden compartir `12W`; dos transformadores de `100W` pueden tener tensiones incompatibles; dos tiras `14,4W IP65` pueden diferir en voltaje, longitud y tecnología. Por tanto:

- no existe base para una página indexable de “mismo modelo” usando sólo títulos;
- el comparador manual actual sigue siendo la experiencia pública correcta;
- un futuro auto-match debe generar candidatos, nunca publicar equivalencias directamente.

## Gate propuesto antes de implementar

1. **Elegibilidad comercial:** verificar `greenice.com` y `barcelonaled.com` dentro de la cuenta real de Skimlinks. Registrar merchant ID, países, deep linking, comisión vigente y restricciones; esos datos cambian y no deben codificarse desde resultados públicos.
2. **Derechos y fuente estable:** pedir feed de afiliado/API/CSV autorizado. Evitar depender de `products.json` como contrato de integración aunque sirva para el spike.
3. **Piloto acotado:** seleccionar 100–300 variantes comparables (bombillas, tubos, paneles y tiras), no clonar todo el catálogo.
4. **Identidad canónica:** guardar identificadores normalizados como EAN/GTIN/MPN cuando existan. SKU interno sólo es prueba dentro del mismo merchant.
5. **Revisión humana:** cola de candidatos con estados `suggested`, `confirmed`, `rejected`; sólo `confirmed` alimenta “mismo producto”.
6. **Calidad mínima:** precio positivo, moneda EUR, URL HTTPS, imagen válida, stock explícito y fecha de observación.
7. **Refresh seguro:** dry-run, umbral de caída de filas, lotes, historial de precio y stale-stock igual que el pipeline de Masterled.

## Resultado para el backlog

B-7 deja de ser un problema de descubrimiento técnico y pasa a estar bloqueado por una decisión externa verificable: elegibilidad Skimlinks + autorización/feed. GreenIce es la primera comprobación; Barcelona LED, el fallback. B-8 debe permanecer bloqueado hasta tener datos reales del segundo merchant y un conjunto revisado de equivalencias.
