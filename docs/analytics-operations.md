# Operativa de analítica

## Estado actual

Shopifind mantiene dos capas separadas:

1. `search_history` en Supabase registra búsquedas y click-outs anónimos para
   métricas operativas propias.
2. Una analítica web autoalojada medirá páginas, fuentes, sesiones, funnels y
   UTMs. No hay tracker general cargando todavía en producción.

Decisión revisada el 2026-07-30: no contratar Plausible Cloud mientras la
economía del proyecto no esté validada. La primera opción es **Umami v3
self-hosted** en uno de los VPS existentes, con subdominio, base de datos,
backups y actualizaciones aislados. Su tracker no usa cookies, admite SPA,
eventos, funnels y UTMs. Matomo queda como alternativa si más adelante hacen
falta informes de marketing más complejos. GA4 sólo se reconsiderará si Google
Ads crea una necesidad concreta que compense Consent Mode y la complejidad
legal/técnica adicional en el EEE.

No desplegar Umami aún: primero el owner debe elegir VPS y subdominio. Antes de
activarlo se documentarán HTTPS, CSP, acceso administrativo, retención, backup
y el texto exacto de privacidad.

El snapshot anterior a la versión 2 contiene 74 filas legacy, 61 búsquedas y
32 click-outs. Varias proceden del smoke de producción, así que no deben usarse
como conversión histórica. No se borran porque no existe una forma fiable de
separarlas de tráfico humano.

Desde `schema_version = 2`, el smoke usa el User-Agent exacto
`shopifind-release-smoke/1.0` y se omite antes del INSERT. Búsquedas y clicks
humanos siguen registrándose, incluso cuando falta User-Agent. Esta versión es
la primera línea base válida para el embudo interno.

`schema_version = 3` amplía cada click-out con producto, tienda, placement,
canal comercial, host del merchant, host técnico de destino y presencia de
UTMs. No almacena IP, cookie ni identificador de usuario. Los clicks canónicos
usan las convenciones descritas en `docs/affiliate-strategy-spain.md`; los deep
links firmados de redes no se modifican automáticamente.

Verificación de producción del 2026-07-29: el conteo quedó en 167 filas totales
y 0 filas v2 tanto antes como después de ejecutar el smoke 18/18 completo.

## Integración Plausible conservada, no activa

El código conserva compatibilidad por si se revisa la decisión. Plausible cambió
su integración en octubre de 2025: cada sitio utiliza ahora
un script único `https://plausible.io/js/pa-XXXXX.js` y una llamada explícita a
`plausible.init()`. El antiguo `https://plausible.io/js/script.js` no se acepta.

No ejecutar estos pasos ahora. Si se reactiva Plausible: crear o abrir el sitio
`shopifind.app`, obtener el script y seguir las validaciones ya implementadas:

1. Abrir **Site settings → General → Site Installation → Review Installation**.
2. Copiar sólo la URL exacta `https://plausible.io/js/pa-….js`.
3. Añadir en Vercel, para Production:

   ```text
   NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC=https://plausible.io/js/pa-….js
   ```

4. Eliminar la variable legacy `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` si existe y hacer
   redeploy. No activar medición en Preview para no mezclar pruebas con tráfico.
5. Usar el verificador de instalación de Plausible y comprobar en el HTML una
   sola URL `pa-….js` y una sola llamada `plausible.init()`.
6. Navegar entre dos rutas: el router `pushState` está soportado de forma
   automática. Confirmar la sesión en el dashboard antes de declararlo activo.

El código valida host, ruta y formato del script; una URL genérica o externa se
trata como configuración ausente y no se renderiza. El smoke falla si reaparece
el snippet genérico o si se carga el tracker nuevo sin inicialización.

Fuentes oficiales consultadas el 2026-07-29:

- https://plausible.io/docs/plausible-script
- https://plausible.io/docs/script-update-guide
- https://plausible.io/docs/spa-support
- https://plausible.io/privacy-focused-web-analytics
- https://matomo.org/faq/on-premise/matomo-requirements/
- https://support.google.com/analytics/answer/12334711?hl=es

Fuentes de la decisión revisada el 2026-07-30:

- https://docs.umami.is/docs
- https://docs.umami.is/docs/about
- https://plausible.io/self-hosted-web-analytics
- https://matomo.org/guide/installation-maintenance/matomo-on-premise-self-hosted/

## Consultas operativas

Conteo de la línea base fiable:

```sql
SELECT
  filters->>'event' AS event,
  count(*) AS events,
  min(created_at) AS first_seen,
  max(created_at) AS last_seen
FROM public.search_history
WHERE filters->>'schema_version' IN ('2', '3')
GROUP BY 1
ORDER BY 1;
```

Desglose comercial de click-outs v3:

```sql
SELECT
  filters->>'store_slug' AS store,
  filters->>'placement' AS placement,
  filters->>'channel' AS channel,
  count(*) AS clicks
FROM public.search_history
WHERE filters->>'event' = 'click_out'
  AND filters->>'schema_version' = '3'
GROUP BY 1, 2, 3
ORDER BY clicks DESC;
```

No interpretar `searches / click_outs` como usuarios únicos: son eventos. La
conversión por sesión y adquisición corresponderá a Umami cuando esté activo.
