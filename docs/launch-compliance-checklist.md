# Gate legal y de privacidad antes de escalar tráfico

> Revisión técnica de 2026-07-28; no sustituye asesoramiento jurídico. No completar las páginas públicas con datos inventados.

## Hallazgo

`/legal` y `/privacy` son todavía scaffolds, aunque el dominio ya está público y usa enlaces de afiliado. El código no dispone de los datos necesarios para publicar textos completos y verificables.

La LSSI española exige que un servicio de la sociedad de la información permita acceder de forma permanente, fácil, directa y gratuita a la identidad o denominación del prestador, domicilio, email y otros datos de contacto, datos registrales cuando correspondan y NIF. Fuente oficial: [artículo 10 de la Ley 34/2002](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758#art10).

El artículo 13 del RGPD exige, entre otros puntos, identidad y contacto del responsable, fines, base jurídica, destinatarios, transferencias, conservación y derechos. Fuente oficial: [Reglamento (UE) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj).

## Datos que debe decidir/proporcionar el owner

- nombre completo o denominación social del titular;
- NIF/CIF y domicilio o establecimiento aplicable;
- datos del Registro Mercantil u otro registro, si corresponden;
- email público de contacto efectivo y email de privacidad;
- jurisdicción/país de establecimiento;
- bases jurídicas elegidas para cuenta, wishlist, alertas, búsquedas y medición;
- plazos de conservación para cuenta, consultas, click-outs, alertas, historial de precios y atribución;
- lista contractual de encargados y regiones efectivas: Vercel, Supabase, OpenAI, Resend y cualquier analítica que se active;
- mecanismo operativo para acceso, exportación, rectificación y borrado;
- si el servicio admite menores y, si no, edad mínima;
- criterio jurídico sobre el uso de marcas, nombres, imágenes y descripciones de merchants.

No compartir secretos, claves API, credenciales OAuth ni documentos de identidad por el repositorio. Los datos anteriores destinados al aviso legal serán públicos por naturaleza.

## Tratamientos que el texto actual debe describir

- Supabase Auth conserva email, identificadores y perfil cuando se crea una cuenta;
- wishlist y alertas relacionan productos y preferencias con el usuario;
- `search_history` conserva consulta, intención/filtros, paginación, total y click-out de forma anónima a nivel de fila;
- una consulta puede enviarse a OpenAI para extraer filtros cuando la integración está activa;
- Resend recibe email y contenido del aviso para entregar alertas activas;
- `/go/<slug>` redirige a Skimlinks y después al merchant; desde ese punto aplican sus tecnologías y políticas;
- Plausible está contemplado en código, pero el script no aparece en producción
  mientras no se configure la URL específica
  `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC` entregada por el proveedor.

## Cookies y tecnologías similares

El frontend actual no instala un loader cliente de Skimlinks: el contacto con su dominio ocurre tras pulsar un CTA afiliado. Las cookies de sesión de Supabase son necesarias para auth. Plausible no está cargando en el snapshot live comprobado.

Antes de activar cualquier script de analítica, publicidad o afiliación en cliente, repetir un inventario real de cookies/local storage y decidir el consentimiento con asesoramiento. La AEPD indica que las cookies que impliquen seguimiento o análisis del comportamiento pueden requerir consentimiento válido y que aceptar y rechazar deben ofrecerse al mismo nivel: [FAQ oficial](https://www.aepd.es/preguntas-frecuentes/17-internet-y-redes-sociales/FAQ-1707-importancia-de-las-cookies-en-la-proteccion-de-datos) y [Guía de cookies](https://www.aepd.es/guias/guia-cookies.pdf).

## Cambios técnicos cuando estén los datos

1. Sustituir “Última actualización: hoy” por una fecha real versionada.
2. Centralizar la identidad pública y emails en una configuración legal única.
3. Reescribir `/legal` y `/privacy` con los datos, fines, bases, destinatarios, conservación, derechos y transferencias decididos.
4. Quitar redes o proveedores no usados; no prometer anonimato, ausencia de tracking o regiones que no se hayan verificado.
5. ✅ Flujo de borrado/exportación de cuenta implementado y probado: JSON
   paginado/no-store y hard-delete con confirmación explícita. Una migración
   elimina las búsquedas atribuibles dentro de la misma transacción de cascada.
6. Ejecutar un smoke de links, accesibilidad y almacenamiento de navegador.
7. Revisar profesionalmente el riesgo de marca: un disclaimer no reemplaza una búsqueda de disponibilidad ni una autorización.

## Cambios seguros aplicados ya

- La PDP ya muestra el aviso justo debajo del CTA afiliado.
- El comparador también muestra el aviso junto a sus CTAs desde este gate.
- `rel="sponsored"` identifica los enlaces afiliados para navegadores y buscadores.
- `/account` permite exportar Auth/identidades, perfil, wishlist, búsquedas,
  alertas y entregas; el endpoint privado responde 401 sin sesión y nunca se
  cachea.
- El borrado usa el usuario validado server-side, exige escribir su email y
  elimina perfil, wishlist, alertas, entregas y búsquedas asociadas. Un E2E
  temporal en Cloud verificó la cascada completa sin usar una cuenta real.

Hasta completar este gate, no activar AdSense, newsletters promocionales ni campañas de adquisición pagada.
