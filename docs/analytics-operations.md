# Operativa de analítica

## Estado actual

Shopifind mantiene dos capas separadas:

1. `search_history` en Supabase registra búsquedas y click-outs anónimos para
   métricas operativas propias.
2. Plausible medirá páginas, fuentes y sesiones cuando el owner cree el sitio y
   active su snippet específico. No está cargando todavía en producción.

El snapshot anterior a la versión 2 contiene 74 filas legacy, 61 búsquedas y
32 click-outs. Varias proceden del smoke de producción, así que no deben usarse
como conversión histórica. No se borran porque no existe una forma fiable de
separarlas de tráfico humano.

Desde `schema_version = 2`, el smoke usa el User-Agent exacto
`shopifind-release-smoke/1.0` y se omite antes del INSERT. Búsquedas y clicks
humanos siguen registrándose, incluso cuando falta User-Agent. Esta versión es
la primera línea base válida para el embudo interno.

Verificación de producción del 2026-07-29: el conteo quedó en 167 filas totales
y 0 filas v2 tanto antes como después de ejecutar el smoke 18/18 completo.

## Activar Plausible

Plausible cambió su integración en octubre de 2025: cada sitio utiliza ahora
un script único `https://plausible.io/js/pa-XXXXX.js` y una llamada explícita a
`plausible.init()`. El antiguo `https://plausible.io/js/script.js` no se acepta.

1. Crear o abrir el sitio `shopifind.app` en Plausible.
2. Ir a **Site settings → General → Site Installation → Review Installation**.
3. Copiar sólo la URL exacta `https://plausible.io/js/pa-….js`.
4. Añadir en Vercel, para Production:

   ```text
   NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC=https://plausible.io/js/pa-….js
   ```

5. Eliminar la variable legacy `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` si existe y hacer
   redeploy. No activar medición en Preview para no mezclar pruebas con tráfico.
6. Usar el verificador de instalación de Plausible y comprobar en el HTML una
   sola URL `pa-….js` y una sola llamada `plausible.init()`.
7. Navegar entre dos rutas: el router `pushState` está soportado de forma
   automática. Confirmar la sesión en el dashboard antes de declararlo activo.

El código valida host, ruta y formato del script; una URL genérica o externa se
trata como configuración ausente y no se renderiza. El smoke falla si reaparece
el snippet genérico o si se carga el tracker nuevo sin inicialización.

Fuentes oficiales consultadas el 2026-07-29:

- https://plausible.io/docs/plausible-script
- https://plausible.io/docs/script-update-guide
- https://plausible.io/docs/spa-support

## Consultas operativas

Conteo de la línea base fiable:

```sql
SELECT
  filters->>'event' AS event,
  count(*) AS events,
  min(created_at) AS first_seen,
  max(created_at) AS last_seen
FROM public.search_history
WHERE filters->>'schema_version' = '2'
GROUP BY 1
ORDER BY 1;
```

No interpretar `searches / click_outs` como usuarios únicos: son eventos. La
conversión por sesión y adquisición corresponde a Plausible cuando esté activo.
