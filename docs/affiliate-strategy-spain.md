# Estrategia de afiliación para España

> Snapshot: 2026-07-30. Las condiciones públicas cambian; comprobar siempre
> los términos que muestra el programa al aprobar la cuenta. Ningún programa se
> considera activo hasta probar un deep link real y una venta de test admisible.

## Decisión

Shopifind deja de depender de una red agregadora. El orden de resolución de
`/go/<slug>` es:

1. enlace aprobado de la tienda o red (`products.affiliate_url`);
2. agregador sólo con opt-in operativo explícito;
3. URL canónica del producto con atribución UTM de Shopifind.

Skimlinks rechazó la solicitud y fue retirado del runtime. No forma parte de la
estrategia prevista; las alternativas son redes publisher y programas directos.

## Altas prioritarias del owner

| Orden | Alta | Objetivo | Datos públicos verificados | Acción |
| ---: | --- | --- | --- | --- |
| 1 | Awin publisher | Base española y reserva comercial | Alta de publisher; directorio de anunciantes y reporting | Crear cuenta con la identidad fiscal real de Shopifind. Puede solicitar un pequeño depósito reembolsable de verificación. |
| 2 | Rakuten Advertising publisher | Monetizar Rapanui | Rapanui ID `50425`, comisión publicada desde 6 % y cookie de 10 días | Crear cuenta, añadir `shopifind.app` y solicitar el programa 50425. |
| 3 | ShiftCam directo | Monetizar 10 productos ya públicos | Programa oficial global: 10 % sobre venta | Solicitar como website/blog y confirmar que admite España/EUR y deep links por producto. |
| 4 | Native Union directo | Desbloquear piloto de 10 productos | Programa creator: 10 %; código de 15 % para la audiencia | Solicitar con Shopifind como blog/editorial de diseño y tecnología. |
| 5 | Wildling directo | Nuevo merchant de moda con buen encaje | Página pública: 15 %; blog/web admitido. Términos: sólo empresarios y plataforma GRIN | Solicitar sólo si el titular que factura cumple el requisito de empresario/profesional. |
| 6 | Philips Hue directo | Reserva comercial de iluminación | 7 % mínimo y hasta 10 % el primer mes; feed/assets/reporting | Solicitar tras separar claramente la capa comercial de la selección indie. |

Awin permite además solicitar PcComponentes España, advertiser `20982`, con
comisiones publicadas de hasta el 7 %. Es valioso para comparación y cobertura,
pero no debe presentarse como tienda indie.

Fuentes oficiales:

- https://www.awin.com/es/pricing/affiliate-partners
- https://ui.awin.com/publisher-signup/es/awin/
- https://rakutenadvertising.com/es-es/publishers/
- https://rapanuiclothing.com/affiliate/
- https://affiliate.shiftcam.com/shiftcam-us/register
- https://www.nativeunion.com/pages/collab
- https://www.wildling.shoes/en/pages/partnerschaften
- https://www.wildling.shoes/en/pages/affiliate-terms-of-service
- https://www.philips-hue.com/es-es/explore-hue/affiliate-programme
- https://www.pccomponentes.com/landings/afiliados

## Contactos directos

| Merchant | Estado | Canal/acción |
| --- | --- | --- |
| Masterled | 50 productos públicos en modalidad pro-bono | No solicitar afiliación. Mantener feed, selección y tráfico medido con UTMs, sin comisión. |
| Oakywood | 10 productos públicos; no se localizó programa publisher público | Escribir a `contact@oakywood.shop` y pedir partnership editorial/affiliate para España. |
| Woodendot | Piloto 12/12 listo y oculto | Solicitar en su página oficial `/pages/affiliates`; pedir términos, territorio y deep linking. |
| Thinking MU | Piloto 12/12 listo y oculto; sin programa público localizado | Contactar a partnerships/marketing y proponer piloto español medible. |
| Orbitkey | Piloto 10/10 listo y oculto | La marca confirma programa bajo solicitud: `press@orbitkey.com`. |
| Rapanui | Público y programa conocido | Si Rakuten tarda, escribir también a `affiliates@rapanuiclothing.com`. |

No publicar un piloto nuevo como “monetizado” sólo porque exista un formulario.
La activación exige aprobación, términos compatibles con España y deep links
que preserven el destino exacto del producto.

## Qué tiene que proporcionar el owner

Antes de las solicitudes:

1. identidad del titular que explotará Shopifind: nombre/razón social, NIF/CIF,
   domicilio de contacto y, si procede, datos registrales;
2. decidir si las cuentas se abren como persona profesional/autónomo o sociedad;
3. crear `partners@shopifind.app` (o confirmar otra dirección estable) para las
   solicitudes y comunicaciones con merchants.

Después de cada aprobación, entregar al desarrollo sólo:

- nombre de red y advertiser/program ID;
- publisher/site ID no secreto;
- territorios y moneda aprobados;
- comisión, cookie, restricciones y política de paid search/cupones/email;
- un deep link de ejemplo a un producto real;
- acceso a feed/API e instrucciones sobre uso de imágenes, si existe.

Las contraseñas, datos bancarios y fiscales no se comparten por chat. Las API
keys se guardan en `.env.local` y en Vercel; nunca se versionan.

## Descripción para solicitudes

Texto base, sin inflar tráfico ni audiencia:

> Shopifind is a Spanish-language editorial product-discovery and comparison
> website focused on curated independent and direct-to-consumer stores. Users
> discover products through category collections, onsite search, product pages,
> comparisons, wishlists and price-drop alerts, then complete the purchase on
> the merchant's website. Our primary market is Spain, with relevant EU
> merchants. Promotion is based on original editorial curation, organic search
> and transparent disclosed affiliate links. We do not use cashback, toolbars,
> forced clicks, cookie stuffing or brand-keyword paid search.

Indicar siempre las cifras reales que pida el formulario. Si el tráfico aún es
pequeño, explicarlo como proyecto nuevo ya desplegado y con catálogo curado; no
inventar pageviews, comunidad ni tasas de conversión.

## Plantilla de contacto directo

Asunto: `Partnership proposal for Spain — Shopifind.app`

> Hello,
>
> I run Shopifind.app, a Spanish-language editorial product-discovery and
> comparison site for curated independent and D2C stores. We have prepared a
> small, quality-controlled selection of your products for users in Spain and
> would like to publish it under an approved commercial relationship.
>
> We can send traffic through product-level links and report outbound clicks by
> product and placement. Our outbound URLs use transparent Shopifind campaign
> attribution, and we can implement your affiliate platform, coupon or agreed
> tracking format without changing signed links.
>
> Could you confirm availability for Spain, commission and cookie terms,
> product deep linking, permitted use of product images/data, and whether a
> product feed or API is available?
>
> Website: https://shopifind.app
> Contact: partners@shopifind.app

## Atribución técnica

Mientras no exista acuerdo, el destino recibe:

```text
utm_source=shopifind
utm_medium=referral
utm_campaign=product_discovery
utm_content=<placement>-<product-slug>
```

`placement` está limitado a `pdp`, `compare`, `collection`, `search` o
`unknown`; el usuario no puede inyectar etiquetas arbitrarias.

Internamente cada salida registra, sin IP ni identificador publicitario:

- producto y tienda;
- placement;
- canal (`referral`, `merchant_affiliate` o `aggregator`);
- host del merchant y host técnico de destino;
- si se aplicaron UTMs.

Los enlaces directos de redes nunca se modifican automáticamente. Primero se
genera en la herramienta del programa un deep link cuyo destino ya contenga las
UTMs permitidas; después se prueba el salto completo y se guarda la URL exacta.

## Criterio de viabilidad

El proyecto sigue siendo viable como buscador editorial y comparador con
afiliación por merchant. Todavía no está validada su economía. Antes de ampliar
catálogo sin límite deben medirse:

1. adquisición → búsqueda/colección;
2. búsqueda → PDP;
3. PDP/comparador → click-out;
4. click-out → venta y comisión por merchant;
5. ingreso por mil sesiones y coste mensual real.

El primer hito comercial es conseguir al menos un programa activo y una venta
atribuida end-to-end. El segundo es tener dos merchants monetizables por nicho.
SEO, contenido editorial y GEO/descubrimiento por LLM se optimizarán en una fase
posterior, cuando las funcionalidades, URLs y cobertura comercial sean estables.
