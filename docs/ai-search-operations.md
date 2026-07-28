# Operación de la búsqueda con IA

## Controles en código

- Consulta normalizada y limitada a 240 caracteres.
- Salida estricta y validada con Zod; máximo 250 tokens de respuesta.
- Timeout de 4 segundos y cero retries: el buscador literal sigue funcionando
  ante timeout, cuota, rate limit o respuesta inválida.
- `OPENAI_SEARCH_ENABLED=false` actúa como kill switch sin retirar la clave.
- Las interpretaciones estructuradas válidas se guardan una hora en el Data
  Cache de Next.js. Query normalizada y modelo forman parte de la clave.
- Los fallos ocurren dentro de la función cacheada y el fallback se aplica
  fuera: una caída temporal no se convierte en un resultado persistente.
- Cada llamada facturable registra modelo y tokens de entrada/salida/total en
  logs, pero no registra el texto de la consulta.

El caché reduce llamadas repetidas y picos por consultas populares. No impide
el abuso mediante consultas aleatorias: antes de adquisición pagada o tráfico
alto hay que añadir rate limiting por visitante en el edge/firewall.

## Controles externos obligatorios

En el proyecto de OpenAI usado por producción:

1. Configurar alertas de gasto a umbrales bajos y útiles.
2. Configurar un límite duro mensual por proyecto acorde al presupuesto.
3. Revisar uso, 429 y logs de tokens al menos semanalmente durante el launch.
4. Si hay anomalía, poner `OPENAI_SEARCH_ENABLED=false` en Vercel y redeploy;
   la búsqueda seguirá funcionando de forma literal.

Los límites de RPM/TPM de OpenAI protegen la plataforma y pueden devolver 429,
pero no sustituyen un límite propio por usuario ni un hard cap de gasto.

Fuentes oficiales consultadas el 2026-07-28:

- https://developers.openai.com/api/docs/guides/rate-limits
- https://developers.openai.com/api/docs/guides/spend-limits
- https://nextjs.org/docs/15/app/api-reference/functions/unstable_cache
