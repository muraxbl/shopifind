# Ronda 2 de sourcing — moda, deco e iluminación

> Snapshot técnico y editorial: 2026-07-29. La presencia de un programa de
> afiliación público no confirma que el merchant esté monetizable en la cuenta
> concreta de Skimlinks.

## Decisión

1. **Rapanui — piloto publicado.** Es el mejor encaje entre identidad,
   trazabilidad técnica y potencial comercial. Su programa oficial de afiliados
   publica Rakuten Programme ID 50425, comisión desde 6 %, ventana de 10 días y
   acceso a creatividades. Shopifind mantiene, no obstante, `skimlinks` como
   mecanismo de click-out y `verified=false` hasta comprobar el merchant en el
   dashboard real.
2. **Kave Home — candidato siguiente, bloqueado por feed.** Su programa oficial
   anuncia más de 5.000 referencias, comisión e imágenes en alta resolución. La
   ruta pública de sitemap devolvió un checkpoint anti-bot durante el spike; no
   se intentará eludirlo. Sólo se integrará una selección editorial cuando el
   programa entregue feed o acceso autorizado.
3. **GreenIce — prioridad para iluminación/comparador.** Sigue siendo el mejor
   segundo catálogo técnico por cobertura y estructura, pero se mantiene el
   gate documentado en `merchant-sourcing-lighting.md`: confirmar Skimlinks y
   obtener feed o permiso de reutilización.
4. **Barcelona LED — fallback de GreenIce.** Buen catálogo español y fichas
   técnicas; mismos gates de afiliación y derechos.
5. **Fairphone — reserva editorial para gadgets.** El programa público localizado
   es de partners comerciales B2B, no un programa editorial de afiliación. No se
   ingesta en esta ronda.

## Piloto Rapanui

- 12 productos seleccionados manualmente entre básicos, bolsas reutilizables,
  camisetas de manga larga y sudaderas con temas ambientales.
- 12/12 con stock positivo en el snapshot previo a escritura.
- Precio guardado en GBP, sin conversión ficticia a EUR.
- PDP canónica en `rapanuiclothing.com` e imagen de origen enlazada desde
  `images.podos.io`; no se copia ni aloja ningún asset.
- El ingestor consulta sólo cada ficha seleccionada y los endpoints de producto
  y stock que esa ficha precarga. No llama a `/omnis/v3/product-feed/`, ruta que
  `robots.txt` excluye explícitamente.
- Dry-run por defecto, allowlist exacta de hosts, límite de bytes, timeout,
  validación de canonical, precio, imagen y stock antes de cualquier upsert.

Fuentes oficiales:

- Rapanui: <https://rapanuiclothing.com/affiliate/>,
  <https://rapanuiclothing.com/sitemap.xml> y
  <https://rapanuiclothing.com/robots.txt>.
- Kave Home: <https://kavehome.com/es/es/e/affiliate> y
  <https://help.kavehome.com/hc/es/sections/10492292732957-Programa-de-afiliaci%C3%B3n>.
- Fairphone: <https://www.fairphone.com/partner-program>.

## Política de calidad resultante

Un producto no puede ser público si usa una imagen placeholder, si la imagen no
responde como `image/*`, o si su destino devuelve un 404/410/451 o una página de
“not found”. Un 401/403 de un WAF se registra como advertencia, no como prueba de 404. El auditor sólo pone filas fuera de stock y desactiva tiendas vacías; no
borra datos, de modo que la operación es reversible.
