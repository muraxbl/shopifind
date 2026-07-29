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
| iluminacion         | Masterled       |      1438 |

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
|         4 | Orbitkey         | indie-gadgets       | UCP + `agents.md` públicos                              | Programa oficial disponible previa solicitud     | Reserva sólida, pero origen australiano y logística EU deben validarse por producto                               |
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
justifica todavía una puntuación numérica. Antes de `--write` sigue faltando el
gate del owner en Skimlinks; después hay que desplegar la allowlist, verificar
una imagen mediante `/_next/image` y decidir expresamente la activación.

## Gates antes de escribir

1. Owner elige uno o varios candidatos.
2. Verificar el dominio exacto en Skimlinks, deep linking, territorios y
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
- https://www.orbitkey.com/agents.md
- https://hannun.com/agents.md
- https://twothirds.com/.well-known/ucp
