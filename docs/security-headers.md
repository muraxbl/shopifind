# Cabeceras de seguridad

## Política activa

`next.config.mjs` aplica a todas las rutas:

- CSP con `default-src 'self'`, bloqueo de objetos, frames y bases externas.
- Scripts limitados al propio sitio y Plausible. `unsafe-inline` se mantiene
  porque Next.js inyecta scripts de hidratación; `unsafe-eval` sólo se permite
  durante `next dev`.
- Conexiones de navegador limitadas al propio sitio, Supabase y Plausible.
- Imágenes HTTPS, `data:` y `blob:`; fuentes locales; formularios same-origin.
- `X-Frame-Options: DENY`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`, `nosniff` y referrer estricto.
- `poweredByHeader: false` elimina `X-Powered-By`.

La CSP específica de `next/image` sigue siendo más estricta
(`script-src 'none'; sandbox`) porque el catálogo admite SVG remotos.
`remotePatterns` sólo admite los hosts observados en el catálogo activo:
`masterled.es` y `placehold.co`. Al activar un merchant nuevo hay que añadir
su host de imágenes explícitamente después de inspeccionar el feed.

## Por qué no usamos nonce por petición

Next.js exige render dinámico para propagar correctamente un nonce. Eso
deshabilitaría el render estático/ISR y la caché CDN de las páginas editoriales.
Para este catálogo público se usa una CSP estática compatible con ISR. Si el
riesgo o los requisitos de cumplimiento cambian, evaluar nonces o SRI después
de medir el impacto; SRI sigue marcado como experimental en Next.js 15.

## Verificación

`pnpm smoke:production` exige CSP, Permissions-Policy, anti-frame y ausencia
de `X-Powered-By`, además del resto de comprobaciones de release. Tras cambiar
un proveedor de analytics, auth o assets hay que actualizar primero la
allowlist mínima y repetir build + smoke; no ampliar a comodines globales.

Fuentes oficiales consultadas el 2026-07-28:

- https://nextjs.org/docs/15/app/guides/content-security-policy
- https://nextjs.org/docs/pages/api-reference/config/next-config-js/headers
- https://nextjs.org/docs/pages/api-reference/config/next-config-js/poweredByHeader
- https://vercel.com/docs/headers/response-headers
