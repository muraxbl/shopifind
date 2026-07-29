# Curación editorial de Masterled

> Aplicada en producción el 2026-07-29. La selección pública tiene un máximo
> estricto de 50 variantes; las filas retiradas no se borran.

## Por qué se reduce

Masterled aportaba 1.438 variantes visibles frente a 32 productos de los otros
tres merchants. Ese desequilibrio convertía la búsqueda, el sitemap y la futura
recuperación para IA en un espejo de un solo catálogo. La selección de 50 prima
casos de uso distintos, productos completos y señales reales de interés sobre
precio alto o repetición de temperaturas de color.

## Invariantes

- `MASTERLED_MAX_CURATED_PRODUCTS = 50` es un techo, no un objetivo comercial.
- Nunca se eliminan filas: las no elegidas pasan a `in_stock=false` y conservan
  histórico, URLs, alertas y capacidad de reversión.
- Se protegen dinámicamente todas las filas cuyo título sea un ventilador de
  techo o cuya categoría exacta sea `Carril Enchufes Deslizantes`.
- En el snapshot de aplicación esto preserva 8/8: tres colores de ventilador,
  carriles de 50 y 100 cm, un mecanismo Schuko y dos mecanismos USB A+C.
- Las plazas restantes usan una lista humana ordenada y reservas revisadas. Un
  opcional agotado se salta; una nueva variante protegida desplaza al último
  opcional.
- El cron aborta con `curated_selection_incomplete` antes de desactivar nada si
  no puede completar las 50.
- Un `--limit` de staging nunca desactiva el resto del catálogo.

## Composición de las 50

| Grupo | Filas | Ejemplos |
| --- | ---: | --- |
| Familias protegidas | 8 | ventilador retráctil 3CCT; carriles 50/100 cm; Schuko y USB |
| Interés observado | 9 | G4, PAR30, AR111, transformador 12V, downlight, porcelana vintage, regleta USB |
| Interior/arquitectura | 6 | plafón con sensor, plafón 50W, lámparas Curva, panel IP65 |
| Solar/exterior/piscina | 8 | farolas 40–100W, aplique y baliza PIR, proyector portátil, piscina RGB |
| Smart/seguridad | 6 | diferencial con rearme WiFi, persianas, dimmer, Schuko WiFi, emergencia auto-test |
| Sistemas de tira LED | 7 | tira autorrectificada + alimentación, COB, RGB + controlador, perfil aluminio |
| Profesional/emergencia | 6 | campana multipotencia, panel 72W, kit emergencia, perfilador, T8 emergencia |

Las señales de interés se agregaron sin identidades: click-outs por producto,
productos presentes en wishlist y alertas activas. La bombilla G4 con alerta y
el marco de mecanismo guardado permanecen públicos.

La lista ordenada de IDs y sus reservas vive en
`src/lib/feeds/masterled.ts`. El dry-run de `scripts/seed-lighting-v1.ts`
imprime siempre la lista exacta antes de aceptar `--write`.

## Resultado Cloud

- Feed live: 1.562 filas válidas.
- Selección: 50/50 disponibles, 8 protegidas.
- Filas públicas desactivadas de forma reversible: 1.388.
- Filas Masterled conservadas en `products`: 1.572 históricas; 50 activas.
- Vista pública total: 82 productos (50 + Rapanui 12 + Oakywood 10 + ShiftCam 10).
- IDs de variante esperados y activos: 50/50, sin ausentes ni inesperados.
- Colecciones reconciliadas: techos 6/6, solar 5/5 y carril completo 6/6.
- Alerta activa de la bombilla G4: preservada y con producto disponible.

La diferencia entre 1.562 filas del feed y 1.572 filas históricas es esperable:
un cambio de nombre puede producir un slug nuevo; el anterior queda inactivo y
no se elimina.
