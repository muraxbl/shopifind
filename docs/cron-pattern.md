# Cron de precios y catálogo

## Estado

`GET /api/cron/refresh-masterled` está programado en `vercel.json` una vez al
día, a las 03:15 UTC. `GET /api/cron/process-price-alerts` permanece sin
schedule hasta completar el email E2E con Resend.

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
- El worker evalúa el último estado disponible, encola mediante una clave
  única alerta/snapshot, reclama cada entrega con estado `processing` y usa
  `Idempotency-Key` en Resend. Los target/percentage son one-shot; any-drop
  mantiene como nueva referencia el último precio evaluado.
- La moneda forma parte de la referencia y del ledger. Nunca se comparan
  céntimos de divisas distintas: un cambio de moneda reinicia alertas relativas
  y desactiva objetivos de precio fijo, cuyo importe deja de ser interpretable.
- Un email pendiente se omite si el producto ya está agotado o su precio actual
  o moneda ya no coinciden con el snapshot, evitando avisos obsoletos.

## Prerrequisitos de activación

1. ✅ `supabase/migrations/20260728190000_price_history_alerts.sql` aplicada en
   Supabase Cloud el 2026-07-29; tipos regenerados y 1.613 snapshots baseline
   verificados.
2. ✅ Configurados en Vercel para catálogo, sin compartir valores por chat:
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` y `MASTERLED_FEED_URL`.
   Pendientes de validar para email: `RESEND_API_KEY` y `RESEND_FROM_EMAIL`
   (dominio verificado).
3. ✅ Invocado manualmente el refresh del deployment de producción desde un
   terminal seguro el 2026-07-29:

   ```bash
   curl --fail-with-body \
     -H "Authorization: Bearer $CRON_SECRET" \
     https://shopifind.app/api/cron/refresh-masterled

   ```

   Resultado: 1.562 filas vistas, 1.438 en stock y 9 referencias ausentes
   marcadas como agotadas. La auditoría final confirmó 9 productos nuevos,
   14 cambios de stock, ningún cambio de precio/moneda, 23 snapshots, 2 alertas
   activas intactas y 0 entregas. Smoke público: 17/17.

4. Configurar/validar Resend y ejecutar manualmente el worker desde un terminal
   seguro:

   ```bash
   curl --fail-with-body \
     -H "Authorization: Bearer $CRON_SECRET" \
     https://shopifind.app/api/cron/process-price-alerts
   ```

5. Verificar el JSON, el ledger y la recepción de un email de prueba real.
6. ✅ El refresh de catálogo está añadido a `vercel.json`:

   ```json
   {
     "crons": [
      {
        "path": "/api/cron/refresh-masterled",
        "schedule": "15 3 * * *"
      }
    ]
   ```

}

```

7. Después del email E2E, añadir el worker en una segunda entrada diaria a las
 04:15 UTC. Mantener una hora de margen permite que el refresh termine antes
 de evaluar las bajadas.

## Frecuencia

En Vercel Hobby la frecuencia mínima actual es una ejecución diaria y la hora
puede variar dentro de la franja seleccionada. Un refresco cada 12 horas exige
Vercel Pro o mover el scheduler a Supabase `pg_cron`/otro servicio. Vercel
también advierte que un evento cron puede entregarse más de una vez; el diseño
del trigger y los upserts toleran ese caso.

Fuentes oficiales consultadas el 2026-07-28:

- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://resend.com/docs/dashboard/emails/idempotency-keys
```
