# Ronda 3 de sourcing — segundos merchants por nicho

> Snapshot técnico/editorial: 2026-07-29. Este documento no autoriza todavía
> una ingestión. La elegibilidad real de Skimlinks debe comprobarse en la cuenta
> del owner antes de presentar un piloto como monetizable.

## Cobertura que queremos corregir

Los cuatro nichos ya tienen inventario público, pero la cobertura sigue siendo
muy estrecha:

| Nicho               | Merchant activo | Productos |
| ------------------- | --------------- | --------: |
| sustainable-fashion | Rapanui         |        12 |
| indie-gadgets       | ShiftCam        |        10 |
| home-deco           | Oakywood        |        10 |
| iluminacion         | Masterled       |        50 |

El siguiente objetivo no es clonar catálogos completos: es publicar pilotos de
10–15 productos con procedencia, precio, stock, destino e imagen de origen
verificados. El segundo merchant de iluminación conserva su gate específico en
`merchant-sourcing-lighting.md`.

## Shortlist para decisión

| Prioridad | Candidato        | Nicho               | Permiso/fuente técnica                                  | Afiliación pública                               | Juicio editorial                                                                                                  |
| --------: | ---------------- | ------------------- | ------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
|         1 | **Woodendot**    | home-deco           | UCP + `agents.md` permiten lectura de catálogo sin auth | Página oficial de afiliados                      | Mejor candidato: marca española independiente, fabricación local, madera FSC y circularidad documentadas          |
|         2 | **Thinking MU**  | sustainable-fashion | UCP + `agents.md` permiten lectura de catálogo sin auth | No localizada públicamente; exige gate Skimlinks | Muy buen encaje: fundada en Barcelona, trazabilidad, fibras certificadas y envío EUR desde Girona                 |
|         3 | **Native Union** | indie-gadgets       | UCP + `agents.md` permiten lectura de catálogo sin auth | Programa de creadores/afiliados oficial          | Buen catálogo y EUR para España; claims ambientales deben evaluarse producto a producto, sin eco-score automático |
|         4 | **Orbitkey**     | indie-gadgets       | UCP + `agents.md` permiten lectura de catálogo sin auth | Programa oficial disponible previa solicitud     | Piloto validado: diseño australiano, catálogo EUR y expedición europea desde Países Bajos                         |
|         5 | HANNUN           | home-deco           | UCP + `agents.md` permiten lectura de catálogo sin auth | Sólo se encontró rewards/referral de cliente     | Catálogo útil, pero menor encaje “indie” y sin señal afiliada pública suficiente                                  |
|         6 | TWOTHIRDS        | sustainable-fashion | UCP público; `agents.md` respondió 403 en el snapshot   | No localizada públicamente                       | Encaje editorial fuerte, pero Thinking MU ofrece hoy un contrato técnico más claro                                |

## Recomendación

Implementar, tras aprobación del owner, en este orden:

1. **Woodendot, 12 productos home-deco.** Mesas auxiliares, almacenaje,
   estanterías, lámparas y organizadores. Nos da una segunda tienda en el nicho,
   un programa afiliado explícito y fabricación española bien documentada.
2. **Thinking MU, 12 productos de moda.** Selección equilibrada por categorías,
   sólo con materiales/certificaciones presentes en la ficha concreta. Mantener
   `verified=false` hasta confirmar Skimlinks.
3. **Native Union, 10 gadgets.** Carga, cables y organización tecnológica.
   `eco_score=0` inicialmente; independencia/diseño no equivalen a evidencia eco.

Cada piloto reutilizará el runner UCP existente con contexto `ES`, `es-ES`,
`EUR`, IDs curados, allowlist exacta de host/carpeta de imágenes, dry-run por
defecto y upsert reversible. Antes de `--write` se presentará la lista exacta de
productos y el resultado del dry-run.

## Piloto técnico Woodendot preparado

El 2026-07-29 quedó preparado, pero **no escrito en Supabase**, un piloto de 12
productos:

| Producto                        | Tipo                      | Precio observado |
| ------------------------------- | ------------------------- | ---------------: |
| Pelican · roble medio           | Estante de pared          |            101 € |
| Lua · roble medio               | Lámpara de mesa           |            186 € |
| Ka XL · negro                   | Lámpara de pie            |            449 € |
| Ibon M · nogal                  | Mesa auxiliar             |            279 € |
| Alba Slim · roble ovalado       | Mesita flotante           |            186 € |
| Etna · azul                     | Portavelas de pie         |            549 € |
| Savia · madera oscura           | Banco                     |            799 € |
| Kesito · azul/mostaza/madera    | Organizador de escritorio |             39 € |
| Cielo · roble pigmentado blanco | Estantes y ganchos        |            250 € |
| Sedona · blanco medio           | Jarrón                    |             83 € |
| Cloe · roble/puertas de madera  | Mesa auxiliar             |            696 € |
| Batea L · roble/blanco          | Mesa de centro            |            599 € |

El dry-run oficial UCP devolvió 12/12 disponibles en EUR y la comprobación
directa de cada imagen respondió con contenido `image/*`. La primera selección
incluía el escritorio Alada (`gid://shopify/Product/7941047943416`), pero el
lookup con `available=true` ya no lo devolvía; se rechazó antes de publicar y se
sustituyó por Kesito. El endpoint JSON de producto respondió 429 durante el
spike, por lo que no se usa ni se reintenta: la fuente del piloto es únicamente
el catálogo UCP autorizado por `agents.md`.

Shopify limita `lookup_catalog` a 10 IDs. El runner compartido divide esta
selección en lotes 10 + 2, valida después el conjunto exacto y falla mostrando
IDs ausentes o inesperados. Imágenes limitadas a
`cdn.shopify.com/s/files/1/0661/7029/0424/`; destinos limitados a
`https://woodendot.com/es/products/…`.

La tienda permanece `active=false`, `verified=false`, `featured=false` y con
`eco_score=0`. La evidencia oficial permite etiquetar el piloto como madera
certificada, fabricación UE, circularidad y vocación de larga duración, pero no
justifica todavía una puntuación numérica. La allowlist llegó a producción en
`315f25a`: la imagen Pelican respondió `200 image/jpeg` a 1920 px mediante
`/_next/image` y el smoke quedó 19/19. Antes de `--write` sólo siguen faltando el
gate del owner en Skimlinks y la decisión expresa de escribir/activar.

## Piloto técnico Thinking MU preparado

El mismo 2026-07-29 quedó preparado, también **sin escritura en Supabase**, un
piloto de 12 prendas disponibles:

| Producto | Segmento/tipo             | Material publicado        |  Precio |
| -------- | ------------------------- | ------------------------- | ------: |
| Santos   | Hombre · jersey           | Algodón orgánico          | 79,90 € |
| Tom      | Hombre · camisa           | Algodón orgánico          | 49,90 € |
| Aaron    | Hombre · camiseta         | Algodón orgánico          | 39,90 € |
| Moero    | Hombre · pantalón         | Cáñamo                    | 79,90 € |
| Gus      | Hombre · chaqueta vaquera | Algodón orgánico          |   150 € |
| Alex     | Hombre · bermuda          | Cáñamo + algodón orgánico | 49,90 € |
| Lena     | Mujer · camiseta          | Cáñamo                    | 54,90 € |
| Lenie    | Mujer · blusa             | Algodón orgánico          | 59,90 € |
| Sunniva  | Mujer · vestido           | Algodón orgánico          |   140 € |
| Karina   | Mujer · pantalón          | Algodón orgánico          | 59,90 € |
| Maisie   | Mujer · chaqueta          | Algodón orgánico          |   130 € |
| Jodie    | Mujer · sudadera          | Algodón orgánico          | 69,90 € |

El dry-run UCP devolvió 12/12 en EUR, con al menos una variante disponible y 12
imágenes accesibles. Los destinos quedan limitados a
`https://thinkingmu.com/products/…` y las imágenes a
`cdn.shopify.com/s/files/1/0578/8001/8989/`. La selección se divide en lotes
10 + 2 y falla si desaparece cualquier ID.

Los atributos y tags se derivan de la composición de cada ficha. Algodón
orgánico produce `organic`, `cotton` y `low-water`; cáñamo produce
`low-impact`, `low-water` y `long-lifespan`, respaldados por la explicación
de fibras de la marca. El adaptador también reconoce poliéster reciclado,
Tencel, EcoVero, SeaCell y GOTS, pero sólo los asignará si aparecen en la ficha
concreta. Una prenda sin material explícito aborta el lote.

La tienda queda definida con `eco_score=0`, `active=false`,
`verified=false` y `featured=false`. La allowlist llegó a producción en
`e2e7b63`: la imagen Santos respondió `200 image/jpeg` a 1920 px (100.408
bytes) mediante `/_next/image` y el smoke quedó 19/19. Antes de cualquier
`--write`, Skimlinks debe aprobar la cuenta y después hay que comprobar
`thinkingmu.com` y deep linking.

## Piloto técnico Native Union preparado

El piloto de 10 productos quedó también preparado sin escribir en Supabase:

| Producto                       | Caso de uso             | Precio observado |
| ------------------------------ | ----------------------- | ---------------: |
| (Re)Classic Case · iPhone 17   | funda magnética         |          59,99 € |
| (Re)Classic Case · AirPods 4   | funda de auriculares    |          39,99 € |
| Belt Cable 2-in-1 140W         | cable de carga          |          29,99 € |
| Pocket Cable 60W               | cable compacto          |          29,99 € |
| Fast Desktop Charger 140W      | carga de escritorio     |         129,99 € |
| (Re)Classic Power Bank 5000mAh | batería magnética       |          69,99 € |
| Fold Laptop Stand              | soporte portátil        |          39,99 € |
| Desk Mat                       | escritorio              |          49,99 € |
| W.F.A Backpack                 | mochila                 |         119,99 € |
| Stow Organizer                 | organizador tecnológico |          49,99 € |

El dry-run UCP devolvió 10/10 disponibles en EUR y las diez imágenes de origen
respondieron como `image/*`. Los destinos se restringen a
`www.nativeunion.com/products/...` y los assets a la carpeta exacta
`cdn.shopify.com/s/files/1/0066/9050/4822/`. Tras el deployment, una imagen
real de la funda iPhone respondió 200 tanto en origen como mediante
`/_next/image` a 1920 px.

La tienda permanece `active=false`, `verified=false`, `featured=false` y con
`eco_score=0`. Sólo se derivan materiales, garantía y etiquetas ambientales de
la ficha completa de cada producto; diseño o independencia no se convierten en
claims ambientales. Native Union publica un programa propio de colaboración,
pero no se activa ni se presenta como monetizado mientras Skimlinks siga en
revisión.

## Piloto técnico Orbitkey preparado

El cuarto piloto oculto contiene 10 productos, sin escritura en Supabase:

| Producto                      | Caso de uso                            | Precio observado |
| ----------------------------- | -------------------------------------- | ---------------: |
| Key Organiser · lona encerada | llaves · algodón BCI                   |          27,97 € |
| Key Organiser · cactus        | llaves · alternativa al cuero          |          23,97 € |
| Nest v2                       | organizador/cargador de escritorio     |         129,90 € |
| Foldable Tote                 | bolsa plegable reutilizable            |          16,90 € |
| 2-in-1 Tech Pouch             | organización tecnológica               |          69,90 € |
| Essentials Pouch Trio         | organización modular                   |          35,00 € |
| Compendium Leather Free       | documentación y notas                  |         129,90 € |
| Hybrid Laptop Sleeve v2       | funda, soporte y superficie de trabajo |          79,90 € |
| Orbitkey x Chipolo Tracker v2 | localizador con pila reemplazable      |          27,93 € |
| Desk Mat · mediano            | escritorio · fieltro PET reciclado     |          62,93 € |

El dry-run UCP respondió 10/10 disponibles para España, con precio EUR y las
diez imágenes accesibles como `image/*`. Los destinos se limitan a
`https://www.orbitkey.eu/es/products/...` y los assets a
`cdn.shopify.com/s/files/1/2161/4233/`; cualquier desvío de host, locale o
carpeta aborta el lote.

Las etiquetas se derivan exclusivamente de la descripción y tags de cada ficha:
algodón BCI, cuero de cactus, cuero vegano, Cyclepet/PET o poliéster reciclado,
y certificación GRS cuando se declara explícitamente. El tracker conserva como
atributo su pila CR1632 reemplazable. La marca publica dos años de garantía y
expide el resto de Europa desde Países Bajos, pero esos datos de marca no se
convierten automáticamente en claims ambientales de cada artículo.

La tienda queda `active=false`, `verified=false`, `featured=false` y
`eco_score=0`. Orbitkey declara un programa afiliado propio cuyos detalles se
facilitan bajo solicitud: no se presenta como activo y no se ha usado
`--write`. Antes de publicar hay que solicitar/admitir la relación comercial,
verificar deep links para España y autorizar expresamente la escritura.

## Comprobaciones comerciales complementarias

- **PcComponentes:** programa editorial oficial en Awin para España (merchant
  20982), comisiones publicadas de hasta 7 %, más de 90.000 productos y uso de
  catálogo/comparadores contemplado. Es una reserva potente para comparación
  de precio, no una tienda indie: sólo se integraría mediante admisión y feed
  autorizado, en una capa claramente diferenciada del directorio D2C.
- **Framework:** encaje editorial excelente por modularidad, reparación y
  actualizaciones compatibles, pero no se localizó una solicitud pública de
  afiliación vigente. Queda como candidato editorial sin monetización
  confirmada, no como piloto de catálogo.
- **GreenIce:** el catálogo técnico sigue siendo el mejor candidato de
  iluminación (3.572 productos/4.952 variantes observadas), pero la única
  recompensa pública localizada es un apadrinamiento de clientes, no un
  programa para publishers. Continúa bloqueado por validación Skimlinks y
  feed/permiso; además, dio cero coincidencias exactas de SKU con Masterled.

Fuentes adicionales:

- https://www.pccomponentes.com/afiliados
- https://help.pccomponentes.com/hc/es-es/articles/21057190055197-FAQ-Afiliados
- https://frame.work/about
- https://community.frame.work/t/framework-youtube-sponsorship/80593
- https://greenice.com/pages/programa-de-apadrinamiento

## Gates antes de escribir

1. Owner elige uno o varios candidatos.
2. Esperar la aprobación de la cuenta Skimlinks y después verificar el dominio
   exacto, deep linking, territorios y
   restricciones; si no aparece, el piloto puede seguir siendo editorial pero
   no se describirá como monetizado.
3. Seleccionar manualmente 10–15 IDs y rechazar precio cero, stock ambiguo,
   variantes no EUR, destinos no canónicos o imágenes fuera del CDN permitido.
4. Asignar eco-score sólo con una rúbrica y evidencia por marca/producto. Usar
   0 (“sin evaluación”) cuando no exista base suficiente.
5. Desplegar primero el `remotePatterns` exacto con la tienda inactiva,
   comprobar `/_next/image` en producción y sólo entonces activarla.

## Fuentes oficiales

### Woodendot

- https://woodendot.com/pages/affiliates
- https://woodendot.com/agents.md
- https://woodendot.com/.well-known/ucp
- https://woodendot.com/pages/our-way

### Thinking MU

- https://thinkingmu.com/agents.md
- https://thinkingmu.com/.well-known/ucp
- https://thinkingmu.com/pages/about-us
- https://thinkingmu.com/pages/sustainability
- https://thinkingmu.com/pages/envios-costes

### Native Union y reservas

- https://www.nativeunion.com/pages/collab
- https://www.nativeunion.com/agents.md
- https://www.nativeunion.com/.well-known/ucp
- https://www.nativeunion.com/pages/shipping
- https://www.orbitkey.com/pages/contact
- https://www.orbitkey.eu/agents.md
- https://www.orbitkey.eu/.well-known/ucp
- https://www.orbitkey.eu/pages/shipping
- https://www.orbitkey.eu/pages/sustainability
- https://hannun.com/agents.md
- https://twothirds.com/.well-known/ucp
