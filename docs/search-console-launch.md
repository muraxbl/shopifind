# Lanzamiento en Google Search Console

## Estado verificado

Shopifind está técnicamente listo para enviar su sitemap a Google Search
Console. La última comprobación de producción, el 29 de julio de 2026, confirma:

- `https://shopifind.app/robots.txt` responde y declara el sitemap canónico.
- `https://shopifind.app/sitemap.xml` responde con un `urlset` válido y 95
  URLs absolutas.
- El sitemap contiene las páginas públicas de producto, tienda, colección y
  nicho; excluye búsquedas, autenticación, APIs y redirects `/go/`.
- El smoke de producción valida robots, sitemap, canonical, PDP e imágenes.

Enviar el sitemap ayuda a Google a descubrir las URLs, pero no garantiza que
todas se rastreen o indexen. Un estado `Success` en Search Console significa
que Google pudo leer el archivo, no que haya indexado todas sus entradas.

## Alta inicial, paso a paso

1. Entrar en [Google Search Console](https://search.google.com/search-console/)
   con la cuenta que vaya a ser propietaria del proyecto.
2. En el selector de propiedades, elegir **Añadir propiedad**.
3. Elegir **Dominio** e introducir únicamente `shopifind.app`, sin `https://`,
   `www` ni una ruta. Esta propiedad agrupa HTTP/HTTPS y todos los subdominios.
4. Copiar el registro TXT que muestra Google y añadirlo en la zona DNS de
   `shopifind.app`:
   - tipo: `TXT`;
   - nombre/host: `@` o el valor que use el proveedor para el dominio raíz;
   - valor: exactamente `google-site-verification=...`;
   - TTL: el predeterminado es suficiente.
5. Volver a Search Console y pulsar **Verificar**. Si la propagación todavía no
   ha terminado, conservar la propiedad y reintentar más tarde. No retirar el
   TXT después de verificar: Google puede volver a comprobar la propiedad.
6. Abrir **Sitemaps** dentro de la propiedad verificada y enviar:
   `https://shopifind.app/sitemap.xml`. Si la interfaz ya fija el origen y sólo
   acepta el sufijo, introducir `sitemap.xml`.
7. Esperar a que el informe muestre `Success`. El número de URLs descubiertas
   debería estar cerca de 95; puede variar después de una actualización
   legítima del catálogo.

Referencias oficiales:

- [Tipos de propiedad y verificación de dominio](https://support.google.com/webmasters/answer/34592)
- [Crear y enviar un sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Informe Sitemaps](https://support.google.com/webmasters/answer/7451001)

## Comprobación inicial recomendada

Después de que Google acepte el sitemap, usar **Inspección de URLs** con una
muestra pequeña y representativa:

- `https://shopifind.app/`
- una página `/explore/...`;
- una página `/store/...`;
- una página `/collection/...`;
- dos PDP `/product/...` de merchants distintos.

La inspección sirve para comprobar acceso, canonical y renderizado. Solicitar
indexación de la home y, si hace falta, de alguna página editorial clave; no
solicitar manualmente la indexación de las 82 PDP. Para muchas páginas,
Google recomienda usar el sitemap.

## Seguimiento sin falsos positivos

- **Primer día:** comprobar que Sitemaps muestra `Success` y no presenta errores
  de lectura o parseo.
- **Después de 7 días:** revisar **Indexación > Páginas** filtrando por el
  sitemap. Google recomienda esperar al menos una semana antes de diagnosticar
  una página recién enviada como ausente.
- **Después de 2-4 semanas:** revisar consultas, impresiones, clicks y páginas en
  **Rendimiento**. Un proyecto nuevo puede tardar en generar datos.
- Tratar los estados `Crawled - currently not indexed` y
  `Discovered - currently not indexed` como señales para analizar calidad,
  duplicados y enlazado interno;
  no como motivo para reenviar el sitemap diariamente.
- Comparar tendencias, no exigir que el total indexado sea idéntico al total
  enviado. El sitemap expresa URLs preferidas; Google decide qué indexa.

## Operativa después del alta

El sitemap se regenera bajo demanda con ISR diario (`86400` segundos). No hace
falta volver a enviarlo después de cada refresh: Google consulta periódicamente
la misma URL.

Después de una alta o baja deliberada de merchants:

1. esperar o provocar de forma controlada la regeneración del sitemap;
2. ejecutar `pnpm smoke:production`;
3. comprobar que el recuento y la muestra de URLs son coherentes;
4. revisar Search Console unos días después, sin crear un sitemap nuevo.

Si Search Console informa de un error, reproducir primero desde una red externa:

```bash
curl -I https://shopifind.app/sitemap.xml
curl https://shopifind.app/robots.txt
pnpm smoke:production
```

No cambiar robots, canonical o frecuencia de regeneración sólo para forzar un
nuevo rastreo. Corregir primero la causa concreta que muestre el informe.

## Evidencia que debe registrar el owner

Para cerrar el milestone manual, anotar en `HANDOFF.md`:

- fecha de verificación de la propiedad `shopifind.app`;
- fecha de envío del sitemap;
- estado inicial (`Success` o error concreto);
- URLs descubiertas que muestre Search Console;
- cualquier incidencia que requiera cambio técnico.
