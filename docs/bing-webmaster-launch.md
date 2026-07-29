# Alta en Bing Webmaster Tools

## Estado verificado

Shopifind está listo para registrarse en Bing Webmaster Tools. La comprobación
de producción del 29 de julio de 2026 usando User-Agent de Bingbot confirma:

- `https://shopifind.app/robots.txt` permite el catálogo público y declara el
  sitemap canónico;
- `https://shopifind.app/sitemap.xml` responde con 95 URLs absolutas;
- búsquedas, autenticación, APIs y redirects `/go/` permanecen fuera del área de
  rastreo indicada por robots.

Bing acepta sitemaps XML y también descubre la directiva `Sitemap` de
`robots.txt`. Registrar el XML en Webmaster Tools añade estado de procesamiento,
errores y recuento de URLs; no garantiza que todas terminen indexadas.

## Opción recomendada: importar desde Search Console

Hacer este paso **después** de verificar `shopifind.app` y enviar su sitemap en
Google Search Console:

1. Entrar en [Bing Webmaster Tools](https://www.bing.com/webmasters/) y crear o
   abrir la cuenta que administrará Shopifind.
2. Elegir **Import from Google Search Console**.
3. Iniciar sesión con la cuenta de Google propietaria de `shopifind.app` y
   autorizar a Bing a leer la lista de propiedades verificadas y sus sitemaps.
4. Seleccionar únicamente Shopifind y pulsar **Import**.
5. Confirmar que la propiedad aparece verificada automáticamente.
6. Abrir **Sitemaps** y comprobar que
   `https://shopifind.app/sitemap.xml` figura como importado o procesándose.
7. Cuando termine, el total descubierto debería estar cerca de 95 URLs; el
   catálogo puede hacer que el número cambie legítimamente.

Bing indica que los primeros datos pueden tardar hasta 48 horas. La conexión con
Google queda activa para revalidar periódicamente la propiedad e importar
nuevos sitemaps. Si no se desea ese acceso continuado, puede desconectarse desde
el perfil de Bing, pero antes conviene establecer otro método de verificación.

## Alternativa sin conexión permanente con Google

1. En Bing Webmaster Tools, elegir **Add site** e introducir
   `https://shopifind.app`.
2. Seleccionar uno de los métodos de verificación ofrecidos por Bing, como DNS,
   archivo XML o meta tag.
3. Completar la verificación sin retirar después su evidencia, ya que Bing puede
   volver a comprobar la propiedad.
4. En **Sitemaps**, pulsar **Submit sitemaps** y enviar
   `https://shopifind.app/sitemap.xml`.

Esta opción evita conceder acceso a Search Console, pero duplica la gestión de
la prueba de propiedad.

Referencias oficiales:

- [Añadir, importar y verificar un sitio](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b)
- [Informe y envío de sitemaps](https://www.bing.com/webmasters/help/Sitemaps-3b5cf6ed)
- [Importación desde Google Search Console](https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools)

## Validación y seguimiento

Después de completar el alta:

- comprobar que el sitemap no presenta errores de proceso;
- esperar 48 horas antes de diagnosticar un panel inicialmente vacío;
- inspeccionar una muestra: home, un nicho, una tienda y dos PDP de merchants
  distintos;
- usar **URL Inspection** para investigar una URL concreta, no para enviar las
  82 PDP manualmente;
- registrar fecha, método de verificación, estado y URLs descubiertas en
  `HANDOFF.md`.

## IndexNow: decisión posterior

Bing recomienda IndexNow para notificar altas, cambios o bajas en tiempo real.
No es un requisito para el lanzamiento: el sitemap actual se actualiza como
máximo una vez al día y Bing declara que normalmente consulta los sitemaps
diariamente.

No añadir IndexNow hasta medir que la latencia de descubrimiento del sitemap es
un problema. Si se implementa después, debe notificarse sólo una URL que haya
cambiado realmente y nunca usar el smoke de producción como productor de
eventos.

Fuente oficial:

- [URL Submission e IndexNow](https://www.bing.com/webmasters/help/URL-Submission-62f2860b)
