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

El control debe aplicarse al **proyecto de OpenAI usado por Shopifind**, no sólo
como una alerta general de la organización:

1. Abrir [Project settings](https://platform.openai.com/settings/) y seleccionar
   explícitamente el proyecto cuyas credenciales usa producción.
2. Entrar en **Limits**.
3. En **Spend**, pulsar **Edit spend limit**.
4. Introducir el **Monthly spend limit** decidido por el owner.
5. Activar **Enforce a hard limit** y guardar. Sin esta opción, el importe no
   detiene tráfico.
6. Añadir alertas de gasto antes del límite; como punto de partida operativo,
   usar avisos al 50 % y 80 % del presupuesto mensual.
7. Revisar también el
   [límite de organización](https://platform.openai.com/settings/organization/limits):
   si existe un hard cap menor, se aplicará igualmente a las llamadas del
   proyecto.
8. Sólo después, cambiar `OPENAI_SEARCH_ENABLED=true` en Vercel y desplegar.
9. Revisar uso, respuestas 429 y logs de tokens al menos semanalmente durante
   el lanzamiento.

El owner debe decidir el importe en la moneda que muestre el panel. La cifra no
se guarda en Git ni en variables de entorno: se registra únicamente la fecha y
la existencia del control en `HANDOFF.md`.

## Qué ocurre al alcanzar el límite

- Una alerta de gasto sólo notifica; el tráfico continúa.
- Un hard spend limit hace que las llamadas afectadas devuelvan HTTP 429 con
  código `insufficient_quota`.
- La aplicación no es instantánea: OpenAI avisa de que el gasto contabilizado
  puede superar ligeramente el importe configurado mientras se propaga el
  límite.
- El hard cap configurado, el usage tier aprobado y los créditos prepago son
  controles diferentes; cualquiera de ellos puede dejar una llamada sin cuota.
- En Shopifind ese error entra en el `catch` de `parseQueryIntent()` y la consulta
  continúa como búsqueda literal. No debe convertirse en un error visible para
  el usuario.
- El tráfico se recupera al elevar o retirar el límite, tras su propagación, o
  con el siguiente ciclo mensual. Si hay una anomalía, mantener
  `OPENAI_SEARCH_ENABLED=false` hasta conocer la causa.

## Evidencia para cerrar el gate

Antes de marcar el control externo como completado:

- confirmar que se seleccionó el proyecto correcto;
- confirmar que **Enforce a hard limit** está activo;
- anotar en `HANDOFF.md` la fecha y el importe aprobado, sin capturas que puedan
  revelar IDs o claves;
- conservar al menos una alerta por debajo del hard cap;
- comprobar después del primer día de tráfico real que el dashboard de uso y
  los logs de tokens presentan cifras coherentes.

Los límites de RPM/TPM de OpenAI protegen la plataforma y pueden devolver 429,
pero no sustituyen un límite propio por usuario ni un hard cap de gasto.

Fuentes oficiales consultadas el 2026-07-29:

- https://developers.openai.com/api/docs/guides/rate-limits
- https://developers.openai.com/api/docs/guides/spend-limits
- https://developers.openai.com/api/docs/guides/production-best-practices#managing-billing-limits
- https://nextjs.org/docs/15/app/api-reference/functions/unstable_cache
