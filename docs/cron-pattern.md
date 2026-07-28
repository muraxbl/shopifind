# Cron de precios y catálogo

## Estado

El handler `GET /api/cron/refresh-masterled` está preparado, pero **no está
programado en `vercel.json`**. Mantenerlo así hasta completar todos los
prerrequisitos de activación.

## Contrato de seguridad

- Vercel envía `Authorization: Bearer $CRON_SECRET` a los cron registrados.
- El handler compara el secreto en tiempo constante y falla cerrado si falta.
- `MASTERLED_FEED_URL` sólo acepta HTTPS bajo `masterled.es`; su token se trata
  como secreto y nunca se devuelve ni registra.
- El feed se limita a 8 MiB, 20 segundos y un mínimo de 1.000 filas válidas o
  el 80 % del catálogo existente, lo que sea mayor.
- Antes de descargar o escribir, el handler comprueba que `price_history`
  exista. Así no puede refrescar precios sin conservar snapshots.
- Sólo marca como agotados los productos ausentes después de que todos los
  lotes del feed hayan terminado correctamente.
- El trigger de `price_history` registra únicamente cambios de precio, moneda
  o stock, por lo que una invocación duplicada no duplica snapshots.

## Prerrequisitos de activación

1. Aplicar `supabase/migrations/20260728190000_price_history_alerts.sql` en
   Supabase Cloud y regenerar tipos.
2. Configurar en Vercel, sin compartir valores por chat:
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` y `MASTERLED_FEED_URL`.
3. Invocar manualmente el deployment de producción desde un terminal seguro:

   ```bash
   curl --fail-with-body \
     -H "Authorization: Bearer $CRON_SECRET" \
     https://shopifind.app/api/cron/refresh-masterled
   ```

4. Verificar el JSON de resultado, el histórico creado y una muestra de PDPs.
5. Añadir entonces a `vercel.json`:

   ```json
   {
     "crons": [
       {
         "path": "/api/cron/refresh-masterled",
         "schedule": "15 3 * * *"
       }
     ]
   }
   ```

## Frecuencia

En Vercel Hobby la frecuencia mínima actual es una ejecución diaria y la hora
puede variar dentro de la franja seleccionada. Un refresco cada 12 horas exige
Vercel Pro o mover el scheduler a Supabase `pg_cron`/otro servicio. Vercel
también advierte que un evento cron puede entregarse más de una vez; el diseño
del trigger y los upserts toleran ese caso.

Fuentes oficiales consultadas el 2026-07-28:

- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
