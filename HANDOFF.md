# Shopifind — Handoff del proyecto

> Documento vivo. Última actualización: 2026-07-29. **Estado:** MVP live en `shopifind.app` (Vercel) con DB poblada en Supabase Cloud. 4 nichos curados · 4 stores activas saneadas · 1470 productos activos expuestos · 4 colecciones editoriales · sitemap.xml + robots.txt operacionales.

---

## 1. TL;DR

|                    |                                                                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qué es**         | Buscador B2C de tiendas independientes reales. Indexa 4 nichos curados (sustainable-fashion, indie-gadgets, home-deco, **iluminacion**), permite búsqueda conversacional con IA, wishlist universal cross-store. |
| **Quién monetiza** | Redirect afiliado server-side preparado con Skimlinks publisher `306854X1795120`; la cuenta sigue en revisión y no hay comisión E2E verificada. Comparador manual live; AdSense no integrado.                    |
| **Stack core**     | Next.js 15 (App Router) · TypeScript · Supabase (Postgres + Auth + RLS) · Vercel (`fra1`) · Hestia SMTP (Auth) · Resend (alertas) · Skimlinks · OpenAI · Plausible · Tailwind + shadcn/ui                        |
| **Live URL**       | https://shopifind.app                                                                                                                                                                                            |
| **Status**         | MVP público. Catálogo Masterled incremental: 1572 referencias conservadas · 1438 in-stock tras el refresh del 2026-07-29.                                                                                      |

---

## 2. ¿Qué es Shopifind y para qué se creó?

### Concepto

> **Less Amazon, more you.** Personal shopper digital que indexa tiendas independientes D2C en nichos curados, **no marketplaces**. Target: shopper europeo 25-45 que sabe lo que le importa (sostenibilidad, maker local, ética) pero no quiere pasar 2h buscando entre 100 opciones de AliExpress.

### Por qué existe (3 problemas que resuelve)

1. **Descubrimiento vs. búsqueda**: cuando ya sabes qué tienda quieres, vas directo. Cuando sabes qué _te importa_ pero no la tienda, comes tiempo muerto. Shopifind cataloga por _valores_ (eco_score 0-100, `eco_tags[]`, país, certificaciones) — no solo por keyword.
2. **Afiliación saneada**: Skimlinks auto-joins transactions >60k programas. Cero coupling con cada merchant program (no nos enteramos si uno cambia el commission rate).
3. **Curación humana + IA estructurada**: AI interpreta la query → typed filters (Zod/JSON Schema) → SQL con pg_trgm + tsvector. El humano curador publica colecciones SEO tipo "Top 10 mochilas indie" que rankean para long-tails de alta conversión.

### Dominios defensivos (registrados / a registrar)

- **Operativo**: `shopifind.app` (activo, en producción).
- **Plan B** (recomendado registrar ya): `cartcompass.com` o `nicheradar.com` (~12€/año).

---

## 3. Esquema técnico

```
┌─────────────────────────────────────────────────────────────────────┐
│                              USUARIO                                │
│              (browsers · Googlebot · crawler Skimlinks)             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  VERCEL EDGE  ·  region fra1                        │
│    Next.js 15 App Router  ·  ISR (revalidate=60s por ruta)          │
│                              ·  RSC + Server Actions                │
└──────────────────────┬──────────────────────┬───────────────────────┘
                       │                      │
   ┌───────────────────▼──┐         ┌─────────▼───────────┐
   │   Pages / RSC reads  │         │  Server Actions /   │
   │   via anon key       │         │  Webhooks / Cron    │
   │  - /explore/[niche]  │         │  via service-role   │
   │  - /search           │         │  - /api/products/…  │
   │  - /collections/[…]  │         │  - /api/webhooks/…  │
   │  - /go/[id]  (302)   │         │  - /api/auth/cb     │
   │  - /sitemap.xml      │         └──────────┬──────────┘
   │  - /robots.txt       │                    │
   └─────────┬────────────┘                    │
             │ anon-key read (RLS-protected)   │ service-role bypass RLS
             ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│   SUPABASE CLOUD  ·  Postgres + Auth + Storage + Realtime          │
│                                                                     │
│   ┌──────────┐  ┌─────────────┐  ┌────────────┐  ┌─────────────┐    │
│   │ niches   │  │   stores    │  │  products  │  │ categories  │    │
│   └──────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                  ┌──────────────────┐  ┌──────────────────────┐     │
│                  │ editorial_       │  │ click_attribution    │     │
│                  │ collections      │  │ (Skimlinks webhook)  │     │
│                  └──────────────────┘  └──────────────────────┘     │
│   ┌──────────┐  ┌─────────────┐  ┌────────────┐                     │
│   │ users    │  │  wishlists  │  │  search_   │                     │
│   │          │  │   (JSONB)   │  │  history   │                     │
│   └──────────┘  └─────────────┘  └────────────┘                     │
│                                                                     │
│  · RLS:        public read en stores/products/niches/…              │
│                owner-only en users/wishlists/search_history         │
│  · view:       v_products_with_store (join product + store cols)    │
│  · indexes:    GIN en tsvector (FTS), partial idx en in_stock,      │
│                trigram en eco_tags[/]                              │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  │                │                │
                  ▼                ▼                ▼
   ┌────────────────────┐ ┌──────────────────┐ ┌────────────────────┐
   │ SKIMLINKS  ·  pub  │ │ HESTIA · Auth    │ │ OPENAI  ·  intent  │
   │ 306854X1795120     │ │ auth.shopifind…  │ │ gpt-4o-mini via    │
   │ go.redirectingat…  │ │ Resend: alertas  │ │ Structured Outputs │
   └────────────────────┘ └──────────────────┘ └────────────────────┘
```

### Request lifecycle (ejemplo: usuario hace `/search?q=zapatillas`)

```
1. Browser GET /search?q=zapatillas
        │
2. Next.js (Vercel Edge) → RSC runs src/app/(shop)/search/page.tsx
        │ - force-dynamic (query params)
        │ - llama a searchProducts(input)
        ▼
3. searchProducts (server action) en src/actions/search.ts
        │   a) si q && OPENAI_API_KEY → parseQueryIntent(q) →
        │        JSON Schema strict → { text, niche, eco_tags_any,
        │        min/max_price_cents, sort }
        │   b) merge con params URL (URL gana si está)
        │   c) PostgREST: SELECT … FROM v_products_with_store
        │      WHERE in_stock=true AND title ILIKE … AND …
        │      ORDER BY … RANGE offset, offset+pageSize-1
        ▼
4. RSC renderiza ProductGrid + Pagination (server component)
        │
5. Browser recibe HTML + RSC payload
        │
6. User click en ProductCard "/product/[slug]"
        │ → PDP propia; CTA de compra enlaza a "/go/[slug]"
        │ → 302 server-side a https://go.redirectingat.com/?id=…&url=…&xcust=…
        │ → Skimlinks carga su JS en destino → auto-joins transaction si compra
```

---

## 4. Stack & dependencias

### Runtime

| Capa      | Tech                                                      | Versión            | Comentario                                                                                                                                                                                 |
| --------- | --------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework | **Next.js** App Router                                    | 15.5.22            | RSC + Server Actions. `cookies()`, `params` y `searchParams` se consumen como APIs asíncronas. `experimental.serverActions.bodySizeLimit = 2mb`.                                           |
| Lenguaje  | **TypeScript**                                            | 5.4.5              | `strict` + `noUncheckedIndexedAccess`. Genera `.tsbuildinfo` cacheado.                                                                                                                     |
| UI        | **Tailwind** + **shadcn/ui** + **Radix** + **Lucide**     | 3.4 / latest       | Radix primitives para dialog/popover/tabs/toast. shadcn wrapper.                                                                                                                           |
| Auth + DB | **Supabase** (`@supabase/ssr` + `supabase-js`)            | ssr 0.12 / js 2.43 | Service-role key SOLO server-side.                                                                                                                                                         |
| AI        | **OpenAI** (`OPENAI_SEARCH_MODEL`, default `gpt-4o-mini`) | 4.47               | Chat Completions + Structured Outputs. 4s timeout, sin retry, caché de intent válido 1h, kill switch y fallback literal.                                                                   |
| Affiliate | **Skimlinks** (publisher `306854X1795120`)                | —                  | `go.redirectingat.com` con `xcust=shopifind-<slug>`.                                                                                                                                       |
| Email     | **Resend HTTP API**                                       | REST               | Builder HTML/text, idempotency key y sender configurados sin SDK; entrega real aceptada por Resend y ledger idempotente verificado.                                                       |
| CRM email | **react-hook-form** + **zod**                             | 7.51 / 3.23        | Formularios de captura + validación.                                                                                                                                                       |
| Build     | **tsx** (scripts), **pnpm**                               | 4.16 / 11.17       | Scripts en `/scripts/*.ts` corren vía `tsx`, no `next`. La versión queda fijada en `packageManager`; pnpm 11 lee permisos, overrides y excepciones de antigüedad en `pnpm-workspace.yaml`. |
| Testing   | **playwright-core** (devDep)                              | 1.62               | Solo instalado si activamos Playwright para fix-source-urls SFCC.                                                                                                                          |

### Hosting

| Servicio           | Plan                                  | Región              | Notas                                                                                                                           |
| ------------------ | ------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Vercel**         | Hobby (auto-upgrade si Pro necesario) | `fra1` (Frankfurt)  | `pnpm build` es el comando. Hobby admite hasta 100 cron jobs, pero cada uno como máximo una vez al día y con precisión horaria. |
| **Supabase Cloud** | Free tier → evaluar upgrade           | EU region (default) | DB en lituania-eu-west; auth/pg_net/realtime listos.                                                                            |

### Crons / scheduled jobs

> **Hoy:** refresh de catálogo a las 03:15 UTC y worker de alertas a las 04:15 UTC, ambos diarios y protegidos por `CRON_SECRET`.
>
> **Pendientes** (backlog):
>
> - Valorar scanner cada 12h cuando se migre el scheduler o el plan lo permita; el MVP ejecuta una vez al día por el límite de Vercel Hobby.
> - Configuración externa + prueba end-to-end del webhook Skimlinks. El receiver y el INSERT ya están implementados.

---

## 5. DB schema

> Schema núcleo aplicado manualmente + 5 migraciones registradas como aplicadas en Cloud:
>
> 1. `00000000000000_init.sql` (núcleo + RLS + view)
> 2. `00000000000001_click_attribution.sql` (target Skimlinks webhook)
> 3. `00000000000002_add_iluminacion_niche.sql` (cuarto nicho)
> 4. `20260728190000_price_history_alerts.sql` (aplicada en Cloud el 2026-07-29)
> 5. `20260729143000_account_erasure.sql` (aplicada y probada en Cloud el 2026-07-29)
> 6. `20260729151000_reclassify_oakywood_home_deco.sql` (aplicada y registrada en Cloud el 2026-07-29)

### Tabla por tabla

#### `niches` — los 4 verticales del MVP

```sql
id          TEXT  PK                 -- 'sustainable-fashion' | 'indie-gadgets' | 'home-deco' | 'iluminacion'
label       TEXT                       -- 'Moda sostenible', 'Iluminación'
description TEXT
emoji       TEXT                       -- 👗 🎛️ 🏠 💡
display_order INT
active      BOOLEAN
```

> Insert idempotente en `seed.sql` (3 iniciales) + migración 0002 (cuarto, iluminacion).

#### `stores` — merchants independientes

Campos clave:

- `slug` UNIQUE, `name`, `url` (home del merchant).
- `niche` FK → `niches.id`.
- `eco_score` INT 0-100 (curación humana).
- `values TEXT[]` — chips de marca: `['recycled','b-corp','eu-made','female-founded',...]`.
- `country` TEXT (procedencia del maker, no donde se vende).
- `affiliate_program` ENUM-like: `'skimlinks'` default → `'direct' | 'awin'`.
- `feed_source` ENUM-like: `'csv' | 'rss' | 'api' | 'manual'`.
- `active BOOLEAN` (gating de moderación manual).
- `featured BOOLEAN` (override de orden en `/explore/<niche>`).
- **Indexes**: `idx_stores_niche` (partial WHERE active), `idx_stores_featured` (partial).

#### `products` — el catálogo principal

Campos clave:

- `slug` UNIQUE, `title`, `description`.
- `price_cents INT` CHECK ≥ 0, `currency` default 'EUR'.
- `image_url`, `source_url` (PDP en tienda), `affiliate_url NULL` (server-resolved vía `/go/[id]`).
- `category_id FK → categories.id` (jerárquica por nicho).
- `attributes JSONB` — flexible: `{material, color, size, power_w, ...}`.
- `eco_tags TEXT[]` — chips a nivel producto (no tienda): `['organic','recycled','handmade',...]`.
- `in_stock BOOLEAN` (sync desde feed/ingest).
- `last_seen_at`, `created_at`, `updated_at` (con triggers via `set_updated_at()`).
- **Indexes**:
  - B-tree `idx_products_store` + `idx_products_store_feed (store_id, in_stock, updated_at DESC)`.
  - **GIN en tsvector** de `title || description` (TF-IDF FTS).
  - **GIN en `eco_tags`** (overlap queries rápido).
  - Partial `idx_products_active` WHERE `in_stock = TRUE`.

#### `categories` — jerárquica por nicho

`id TEXT PK` (slug), `parent_id FK self-referencing`, `niche FK`. Habilita árboles como `home-deco > lighting > lamps`.

#### `users` — perfil + plan

FK a `auth.users(id)`. `plan user_plan ENUM('free','plus','pro')`. `niche_prefs TEXT[]` (nichia favorita del usuario para personalizar home). Auto-create vía trigger `handle_new_user()` en signup.

#### `wishlists` — JSONB MVP

`items JSONB DEFAULT '[]'` con shape `[{ product_id, store_url, price_when_added, notify, added_at }]`. Sirve para el MVP de guardar/quitar, pero usa read-modify-write y no modela bien varios tipos de alerta. **Antes de activar alertas programadas**, migrar a una tabla relacional `wishlist_items`/`price_alerts` con constraint por usuario-producto y umbrales explícitos.

#### `search_history` — funnels + AI context

Insert permitido a anónimos (`auth.uid() IS NULL OR auth.uid() = user_id`). RLS solo owner-scoped read. Hoy captura eventos/búsquedas (incluido click-out), pero `parseQueryIntent` **no consulta** el histórico: no existe todavía un self-feedback loop.

#### `price_history` + `price_alerts` + `price_alert_deliveries` — aplicado en Cloud

La migración `20260728190000_price_history_alerts.sql` registra únicamente cambios reales de precio/stock/moneda mediante trigger, separa una alerta configurable por usuario-producto y añade un ledger de entregas con `UNIQUE (alert_id, price_history_id)` para impedir emails duplicados en reintentos. Precio y moneda de referencia quedan congelados juntos para no comparar céntimos de divisas diferentes. Incluye RLS owner-only para alertas, lectura pública del histórico y escrituras del ledger reservadas al service role. Cloud partió de 1.613 snapshots baseline; tras el primer refresh controlado contiene 1.636 filas. Triggers, políticas e índices fueron verificados y una prueba transaccional con `ROLLBACK` confirmó el trigger sin conservar cambios.

#### `editorial_collections` — cápsulas SEO

`product_ids UUID[]` (orden preserva → display order en grid). `published BOOLEAN`, `published_at TIMESTAMPTZ`. RLS: solo `published=TRUE` visible al público.

#### `click_attribution` — target del Skimlinks webhook

> Migración 0001 aplicada + receiver desplegado en `/api/webhooks/skimlinks`. Falta configurar credenciales/CIDRs en producción, registrar la URL en Skimlinks y validar un evento real.

- `xcust` (nuestro custom), `product_slug`, `source_url`, `merchant_id`.
- `intent` ENUM `'visit' | 'buys'` (los dos tipos que Skimlinks envía).
- `paid BOOLEAN`, `commission_cents INT`, `paid_at TIMESTAMPTZ`.
- `raw_payload JSONB`, `payload_timestamp TEXT` (para dedupe del retry).
- **UNIQUE INDEX dedupe**: `(xcust, intent, payload_timestamp)` — Skimlinks puede reenviar el mismo evento.
- **RLS admin-only read** (`auth.jwt() -> 'app_metadata' ? 'admin'`); service-role bypass para escribir desde webhook.

#### View `v_products_with_store`

Reune productos con 10 columnas de `stores` que el frontend lee (`store_name`, `store_slug`, `niche`, `country`, `eco_score`, `values`, `featured`, …). **Por qué existe**: payload <3KB por row (vs ≈12KB si joinamos `*`). Las page-queries (search/explore/PDP) hacen `SELECT … FROM v_products_with_store` con `count='exact'` para pagination.

### Seeds pre-cargados (lo que está en DB hoy)

| Tipo                                      | Cantidad             | Tabla                   | Origen                                                                                                   |
| ----------------------------------------- | -------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Stores seed                               | 6                    | `stores`                | `supabase/seed.sql` (everlane-eu, b-corp-outfitters, killiney-audio, gridloom, casa-vereda, nordic-folk) |
| Productos seed SF/IG/HD                   | 10                   | `products`              | `seed.sql`                                                                                               |
| Productos seed SF extra (ethical-staples) | 4                    | `products`              | `seed.sql` (extend para cápsula curated)                                                                 |
| Productos masterled.es                    | 1572 (in-stock 1438) | `products`              | seed inicial + refresh incremental desde CSV PrestaShop                                                  |
| **Cápsulas editoriales**                  | 4                    | `editorial_collections` | `seed-editorial-collection.ts` + `seed-lighting-collections-v1.ts`                                       |
| **Iluminación store**                     | 1                    | `stores`                | seed-lighting-v1.ts (masterled-es · niche = iluminacion · eco_score 78)                                  |

---

## 6. Funcionalidades desplegadas (live en shopifind.app)

### UI / páginas

| Ruta                              | Status                          | Notas                                                                                                                                                                       |
| --------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                               | ✅ live                         | Hero con AiSearchBox · 4 niche chips · 8 productos featured `last_seen_at DESC` · `<canonical>` + `og:url` apuntando a SITE_CONFIG.url.                                     |
| `/explore/<niche>`                | ✅ live                         | Paginación server-side (24/page, máximo 100 páginas) · chips de nicho · spotlight de colección (Cuando iluminacion → `verano-techos-led`). ISR `revalidate=60`.             |
| `/search`                         | ✅ live                         | DRY-up facet (NICHE_FACET, 4 niches + "Todos") · AI intent parser · filtros sin texto · parámetros URL validados · pagination · selector de comparación.                    |
| `/collections/<slug>`             | ✅ live                         | 4 colecciones (1 SF + 3 iluminación verano) · JSON-LD `ItemList` + `Product/ Offer` schema · rich snippets Google.                                                          |
| `/go/[id]`                        | ✅ live                         | Server-side 302 a Skimlinks con `xcust=shopifind-<slug>` · bloqueado en robots.                                                                                             |
| `/product/<slug>`                 | ✅ live                         | Canonical + Product/Offer JSON-LD seguro, compartir funcional, CTA afiliado, información de tienda, wishlist y alertas con fallback.                                        |
| `/compare?ids=...`                | ✅ live                         | Comparador manual de 2-5 productos, `noindex`, atributos normalizados, mejor precio sólo entre monedas iguales y CTA afiliado por producto; smoke E2E con dos filas reales. |
| `/wishlist`                       | ✅ live                         | Middleware gate + lista owner-only + corazones funcionales en cards/PDP; escritura usa datos autoritativos del producto.                                                    |
| `/account`                        | ✅ live / E2E real              | Perfil owner-only, preferencias, alertas y logout; exportación JSON completa y borrado irreversible con confirmación por email añadidos en milestone 47.                    |
| `/login` + `/api/auth/*`          | ✅ Google + magic link E2E      | Google conserva PKCE. Magic link usa SMTP propio y `TokenHash`: landing GET resistente a prefetch + POST `verifyOtp`, probado PC→móvil con sesión final en `/wishlist`.     |
| `/sitemap.xml`                    | ✅ live                         | 1483 URLs verificadas: 1 home + 4 nichos + 4 tiendas + 4 colecciones + 1470 PDP. ISR diario (`86400`); loop 1000/page.                                      |
| `/robots.txt`                     | ✅ live                         | Allow `/` + disallow `/api/`, `/admin/`, `/auth/`, `/go/`, `/search` + sitemap reference.                                                                                   |
| `/legal` / `/privacy` / `/about`  | ✅ Markdown scaffold            | Páginas-estatic SEO/disclaimer.                                                                                                                                             |
| `/api/products/*` + `/api/auth/*` | ✅ implementado                 | Handlers server-side desplegados; Google OAuth habilitado y probado con sesión real.                                                                                        |
| `/api/cron/refresh-masterled`     | ✅ live / diario 03:15 UTC      | Bearer auth, preflight real de `price_history`, feed allowlisted/acotado y guardias de integridad. Ejecución manual auditada; schedule Vercel diario declarado.             |
| `/api/cron/process-price-alerts`  | ✅ live / diario 04:15 UTC      | Evaluator + outbox con claim, retries, skip de avisos obsoletos e idempotencia Resend. Envío real y segunda pasada sin duplicado verificados.                             |
| `/api/account/export`             | ✅ privado / no-store           | Exporta Auth/identidades, perfil, wishlist, búsquedas, alertas y entregas con paginación estable; anónimo recibe 401 y nunca se cachea.                                     |
| `/api/webhooks/skimlinks`         | ⚠ receiver live / E2E pendiente | Valida tamaño, CIDR, HMAC, payload y replay; inserta con dedupe. Falta conectar Skimlinks y probar evento real.                                                             |
| `/api/test/*`                     | ✅ restringido                  | Gate default-deny y bloqueo absoluto en `NODE_ENV=production`; GET/POST verificados con 404 en `shopifind.app`.                                                             |

### Features cross-cutting

| Feature                          | Componente                                                                        | Status                                                                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI conversational search**     | `src/lib/ai/queryIntent.ts` + `src/actions/search.ts`                             | ✅ wired · fallback gracioso si no hay `OPENAI_API_KEY`.                                                                                                        |
| **Server-side pagination**       | `src/components/pagination/Pagination.tsx`                                        | ✅ page size `[12, 96]`, máximo 100 páginas y offset real sin tandas repetidas.                                                                                 |
| **JSON-LD ItemList**             | `src/app/(shop)/collections/[slug]/page.tsx`                                      | ✅ validado Google Rich Results.                                                                                                                                |
| **Supabase Auth SSR refresh**    | `src/middleware.ts`                                                               | ✅ smoke tested: anónimo en `/wishlist` recibe 307; rutas con prefijo parecido no quedan bloqueadas.                                                            |
| **Skimlinks affiliate redirect** | `src/app/go/[id]/route.ts` + `src/lib/skimlinks.ts`                               | ✅ publisher `306854X1795120`.                                                                                                                                  |
| **Eco-score badges en cards**    | `src/components/product/ProductCard.tsx`                                          | ✅ muestra `store_eco_score` + `eco_tags[..n]`.                                                                                                                 |
| **Wishlist JSONB**               | `src/actions/wishlist.ts` + `src/app/(shop)/wishlist/`                            | ✅ read/write · RLS owner-only · corazones reales y precio/URL resueltos server-side.                                                                           |
| **Gestión de price alerts**      | `src/actions/priceAlerts.ts` + PDP + `/account`                                   | ✅ tres modos, owner-only y cursor precio+moneda; alerta `any_drop` creada con sesión real y baseline/currency/cursor verificados en Cloud.                     |
| **Pricing alerts email**         | `src/lib/email/resend.ts` + `/api/cron/process-price-alerts`                      | ✅ Resend acepta la entrega real, conserva provider ID y una segunda pasada no la duplica; falta sólo confirmar el buzón y limpiar el fixture oculto.           |
| **Autoservicio de datos**        | `/api/account/export` + `src/actions/account.ts`                                  | ✅ exportación autenticada y borrado hard-delete; trigger transaccional elimina búsquedas atribuibles antes de la cascada del perfil.                           |
| **Comparador manual**            | `src/components/compare/CompareSelection.tsx` + `src/app/(shop)/compare/page.tsx` | ✅ picker de 2-5 cards y tabla comparativa sin afirmar equivalencia de modelo. La comparación automática fuerte en iluminación sigue necesitando otro merchant. |

### AI search semantics (`parseQueryIntent`)

Structured Outputs schema (strict, Zod-validated):

```ts
{
  text: string,                          // "zellige rug" limpio / '' si solo filtros
  niche: 'sustainable-fashion'|'indie-gadgets'|'home-deco'|'iluminacion'|null,
  eco_tags_any: SearchEcoTag[],           // sólo tags generadas por los seeds, máximo 5
  max_price_cents: number|null,           // 8000 = €80
  min_price_cents: number|null,
  sort: 'relevance'|'price_asc'|'price_desc'|'newest'
}
```

Si OpenAI está caído, tarda más de 4s o schema validation falla → fallback literal. Sólo las respuestas válidas entran una hora en el Data Cache, con query normalizada + modelo como clave; `OPENAI_SEARCH_ENABLED=false` desactiva llamadas sin perder búsqueda literal. **URL params siempre ganan**, incluido `sort`. Las queries se limitan a 240 caracteres y los valores del `.or()` PostgREST se entrecomillan para que comas/paréntesis no alteren la gramática. `attributes` se retiró del intent hasta que exista ejecución SQL real para ese campo.

---

## 7. Código & infra clave (qué mirar primero)

### Repo tree (top nivel)

```
.
├── HANDOFF.md                             # ⬅ estado real, arquitectura y backlog
├── README.md                              # brand/product dec + setup (aspiracional)
├── next.config.mjs                        # images wildcards + dangerouslyAllowSVG + headers
├── vercel.json                            # framework=nextjs, regions=fra1, pnpm install
├── package.json                           # scripts seed + scripts:fix:urls + scripts:hide:placeholder
├── tsconfig.json / postcss / tailwind / components.json
├── .env.example                           # template documentado
│
├── supabase/
│   ├── config.toml                        # (Supabase CLI; sin usar local — Cloud)
│   ├── seed.sql                           # 6 stores + 10 productos SF/IG/HD
│   ├── migrations/
│   │   ├── 00000000000000_init.sql        # users/stores/products/wishlists/collections + RLS + view
│   │   ├── 00000000000001_click_attribution.sql   # Skimlinks webhook target
│   │   ├── 00000000000002_add_iluminacion_niche.sql # 4º vertical
│   │   └── 20260728190000_price_history_alerts.sql  # aplicado en Cloud 2026-07-29
│   └── scripts/                           # (vacío — los *.ts en /scripts/ del repo son los reales)
│
├── scripts/                                # ⭐ CLI entry points (todos idempotentes con --dry-run / --write)
│   ├── seed-products-v2.ts               # multi-merchant seed (32 merchants target list)
│   ├── seed-editorial-collection.ts      # ethical-staples curation
│   ├── seed-lighting-v1.ts               # masterled.es PrestaShop CSV ingest
│   ├── seed-lighting-collections-v1.ts   # 3 verano capsules (techos-led, exterior-solar, enchufes-deslizantes)
│   ├── fix-source-urls.ts                # sitemap-first hybrid + Playwright SFCC; chunked loop
│   └── hide-placeholder-rows.ts          # descubre `source_url` placeholders (`.example.com`) → live=false
│
└── src/
    ├── app/
    │   ├── layout.tsx                     # root layout + metadataBase + Plausible
    │   ├── page.tsx                       # home con AiSearchBox + 4 nicho chips + 8 featured
    │   ├── globals.css
    │   ├── sitemap.ts                     # ← chunked loop, 1465 URLs
    │   ├── robots.ts                      # ← disallow /api + /go + /search
    │   ├── (shop)/
    │   │   ├── explore/[niche]/page.tsx   # pagination + spotlight + DRY-up facet hidden
    │   │   ├── search/page.tsx            # full filter form + DRY-up facet shown
    │   │   ├── collections/[slug]/page.tsx # JSON-LD ItemList + ProductGrid
    │   │   ├── product/[slug]/page.tsx    # PDP live + CTA afiliado + wishlist
    │   │   ├── store/[slug]/page.tsx      # ⚠ scaffold
    │   │   └── wishlist/page.tsx          # lista owner-only con middleware gate
    │   ├── (auth)/login                                      # UI Supabase Auth
    │   ├── (marketing)/legal + /privacy + /about              # estáticos SEO
    │   ├── api/auth + /products + /test + /webhooks          # Server-only
    │   └── go/[id]/route.ts               # 302 Skimlinks
    │
    ├── components/
    │   ├── pagination/Pagination.tsx     # server component, Anterior/Siguiente + total
    │   ├── product/{ProductCard,ProductGrid}.tsx
    │   ├── search/AiSearchBox.tsx        # textarea + submit, directive to /search?q=
    │   ├── collection/CollectionSpotlight.tsx
    │   ├── store/{StoreBadge,StoreProfile}.tsx
    │   ├── layout/{Header,Footer,LegalDisclaimer}.tsx
    │   └── ui/                            # shadcn primitives (button, badge, dialog, …)
    │
    ├── lib/
    │   ├── auth/redirect.ts               # safeNextPath + boundary matching de rutas protegidas
    │   ├── config.ts                      # SITE_CONFIG + NicheId + NICHE_LABEL + NICHE_FACET + pagination defaults
    │   ├── skimlinks.ts                   # buildSkimlinksUrl(sourceUrl, slug)
    │   ├── ai/queryIntent.ts              # parseQueryIntent (OpenAI Strict)
    │   ├── email/resend.ts                # sendWishlistPriceAlert (Resend stub)
    │   ├── supabase/{server,client,public,admin}.ts
    │   ├── wishlist/items.ts              # normalización/operaciones puras sobre JSONB
    │   ├── env.ts                         # typed env reader
    │   └── utils.ts                       # cn(), formatters (precio, superlative text)
    │
    ├── actions/
    │   ├── search.ts                      # searchProducts(input) → {products, total}
    │   └── wishlist.ts                    # addToWishlist/removeFromWishlist (requireUser + RLS)
    │
    ├── types/database.types.ts            # generado con `pnpm db:types` desde Supabase
    └── middleware.ts                      # Supabase SSR refresh + protected paths (debe vivir en src/)

tests/                                     # node:test: redirects, wishlist y Skimlinks
```

### Archivos **imprescindibles de leer primero** para un nuevo dev

1. **`src/lib/config.ts`** — el "single source of truth" del site. Cambias `primaryNiches` aquí y el home + /search + /explore + sitemap se actualizan.
2. **`supabase/migrations/00000000000000_init.sql`** — schema + RLS completos. **Lee los índices GIN** antes de tocar queries pesadas.
3. **`src/actions/search.ts`** — el coração de la búsqueda. `parseQueryIntent → PostgREST range → count=exact`.
4. **`src/app/sitemap.ts`** — chunked loop, el truco que aprendimos del 1000-row cap.
5. **`src/lib/supabase/server.ts` y `public.ts`** — cliente con sesión/cookies para datos privados y cliente anon stateless con Data Cache para catálogo público; no intercambiarlos.
6. **`next.config.mjs`** — allowlist exacta de hosts de imagen; añadir cada merchant nuevo de forma explícita.
7. **`src/middleware.ts`** — `PROTECTED_PATHS` para extender gates. Con `src/app`, dejarlo en la raíz del repo no lo activa.

---

## 8. Resumen de lo realizado

### Cronología (milestones shipped)

| #      | Milestone                                                                                                              | Commit / artefacto                                                   | Resultado                                                                                                                                                                                                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0**  | Pivot a Supabase Cloud + bootstrap Next.js 14                                                                          | early seeds                                                          | DB en EU, anon + service role conectadas.                                                                                                                                                                                                                                                     |
| **1**  | Schema + RLS + view + 6 stores seed                                                                                    | `seed.sql`                                                           | 6 merchants, 10 productos base, RLS saneada.                                                                                                                                                                                                                                                  |
| **2**  | Editorial collection scaffolding (`editorial_collections` table + page JSON-LD)                                        | migration 0000 + `/(shop)/collections/[slug]/`                       | ItemList schema listo para SEO launch.                                                                                                                                                                                                                                                        |
| **3**  | Skimlinks `/go/[id]` redirect                                                                                          | `src/lib/skimlinks.ts` + `/go/[id]/route.ts`                         | publisher `306854X1795120` activo.                                                                                                                                                                                                                                                            |
| **4**  | masterled.es ingest (lighting)                                                                                         | `scripts/seed-lighting-v1.ts`                                        | **1452 productos in-stock del 1563 ingestados** (eco_score=78).                                                                                                                                                                                                                               |
| **5**  | Seed extension SF ethical‑staples + lighting cápsula "verano-techos-led"                                               | `seed.sql` extend + `seed-editorial-collection.ts`                   | Curación vertical + SEO entry point para iluminación.                                                                                                                                                                                                                                         |
| **6**  | Hardening pre-prod (`npm audit`)                                                                                       | reportado · upgrades safe-only                                       | 0 critical vulnerabilidad (3 dev-deps sub-pinned that flagged).                                                                                                                                                                                                                               |
| **7**  | Middleware Supabase SSR refresh                                                                                        | `src/middleware.ts`                                                  | auth cookie persist + gates /wishlist, /account, /settings.                                                                                                                                                                                                                                   |
| **8**  | Pagination + DRY-up facet                                                                                              | commit `e46139d`                                                     | offset pagination, NICHE_FACET unifica search + explore + home, SSR-safe.                                                                                                                                                                                                                     |
| **9**  | JSON-LD ItemList schema en collection pages                                                                            | `/(shop)/collections/[slug]/page.tsx`                                | Google Rich Results detectados y validan OK.                                                                                                                                                                                                                                                  |
| **10** | Deploy Vercel + dominio `shopifind.app`                                                                                | vercel.json + env vars                                               | Production URL activa.                                                                                                                                                                                                                                                                        |
| **11** | `/sitemap.xml` + `/robots.txt` (Next 13+)                                                                              | commit `4b171b9` (tras fix de orphan code block)                     | 1461 URLs · ISR 1h · block `/go/`, `/search`, `/api`, `/auth`, `/admin`.                                                                                                                                                                                                                      |
| **12** | canonical + og:url en `/`                                                                                              | `src/app/page.tsx` `metadata` export                                 | consolida signal en GSC.                                                                                                                                                                                                                                                                      |
| **13** | 3rd merchant SEO curation: `seed-lighting-collections-v1.ts` (verano-techos-led, exterior-solar, enchufes-deslizantes) | seed iluminacion v1                                                  | 3 cápsulas curadas para verano 2026.                                                                                                                                                                                                                                                          |
| **14** | Domain final enlazado Vercel                                                                                           | `shopifind.app`                                                      | DNS A + TXT configured.                                                                                                                                                                                                                                                                       |
| **15** | Auth/wishlist/PDP hardening + tests                                                                                    | `fcad59b`, `98189ff`                                                 | Redirects internos saneados, middleware activo en `src/`, wishlist real, datos autoritativos server-side, sitemap y `/go` excluyen catálogo inactivo; 7 tests y smoke live.                                                                                                                   |
| **16** | Account + profiles                                                                                                     | `src/app/(shop)/account` + `src/actions/profile.ts`                  | `/account` owner-only, edición validada de nombre/nichos, plan visible, logout local, navegación responsive; 10 tests totales y build limpio.                                                                                                                                                 |
| **17** | AI search contract hardening                                                                                           | `src/lib/ai/queryIntent.ts` + `src/lib/search/postgrest.ts`          | Iluminación soportada, tags catalog-backed, filtros puros, URL precedence, límite/timeout, escape PostgREST y fallback cubiertos; 16 tests y consulta read-only real validada.                                                                                                                |
| **18** | Comparador manual MVP                                                                                                  | `src/components/compare` + `/(shop)/compare`                         | Selección de 2-5 cards, URL validada y acotada, tabla `noindex`, atributos agrupados, comparativa de precios segura por moneda y CTAs `/go`; 19 tests totales y build limpio.                                                                                                                 |
| **19** | Search filter-only + URL hardening                                                                                     | `src/lib/search/input.ts` + `/(shop)/search`                         | Nicho/eco-tag/precio funcionan sin texto, enums y cifras se validan en runtime, eco-tag rápido respaldado por catálogo y toggle para limpiar; 21 tests totales.                                                                                                                               |
| **20** | Guarded Masterled refresh                                                                                              | `373d38d`                                                            | Parser único CLI/cron, 1.563 filas reales validadas, Bearer auth, preflight, lotes y stale-stock; endpoint live devuelve 401 y no tiene schedule.                                                                                                                                             |
| **21** | Price-alert management UI                                                                                              | `src/actions/priceAlerts.ts` + `PriceAlertCard` + `PriceAlertList`   | Tres modos validados, baseline/cursor autoritativos, PDP/cuenta y fallback honesto si falta schema.                                                                                                                                                                                           |
| **22** | Price-alert evaluator + idempotent sender                                                                              | `/api/cron/process-price-alerts` + `src/lib/alerts/evaluate.ts`      | Estado final del ciclo, outbox con claim/recovery, precio de referencia congelado, stale skip, Resend idempotency y HTML escapado; 33 tests totales.                                                                                                                                          |
| **23** | Sourcing del segundo merchant de iluminación                                                                           | `docs/merchant-sourcing-lighting.md`                                 | GreenIce recomendado y Barcelona LED como fallback; catálogos públicos viables, pero cero SKU exactos cross-store. Ingest bloqueada hasta verificar Skimlinks y obtener feed/permiso.                                                                                                         |
| **24** | Telemetría interna fiable                                                                                              | `src/lib/analytics/*`                                                | Búsquedas y click-outs se escriben con cliente anónimo y operación esperada; eventos estructurados, total real y paginación. Plausible sigue sin configurar.                                                                                                                                  |
| **25** | PDP SEO + share real                                                                                                   | `src/lib/seo/jsonLd.ts` + `ShareButton`                              | Canonical/OG URL, Product/Offer con seller honesto, serialización anti-`</script>` y Web Share/clipboard; JSON-LD de colecciones corregido.                                                                                                                                                   |
| **26** | Upgrade de seguridad Next.js 15                                                                                        | `package.json` + `pnpm-workspace.yaml` + migración de APIs dinámicas | Next 15.5.22, pnpm 11.17 fijado, dependencias transitivas vulnerables parcheadas por override; build de producción y 39 tests pasan y `pnpm audit` completo reporta 0 vulnerabilidades.                                                                                                       |
| **27** | Smoke de release automatizado                                                                                          | `scripts/smoke-production.ts`                                        | 15 checks read-only descubren una PDP desde sitemap y validan navegación, paginación, auth, cabeceras, robots, SEO, imágenes, Skimlinks, cron y ocultación de APIs de test.                                                                                                                   |
| **28** | Hardening de cabeceras web                                                                                             | `next.config.mjs` + `docs/security-headers.md`                       | CSP compatible con ISR, Permissions-Policy, anti-frame estricto y COOP; `X-Powered-By` eliminado y el smoke ampliado para impedir regresiones.                                                                                                                                                |
| **29** | Control operativo de AI search                                                                                         | `queryIntent.ts` + `docs/ai-search-operations.md`                    | Caché compartida 1h sólo para intents válidos, kill switch, telemetría de tokens sin query y fallback literal; control puro cubierto por tests.                                                                                                                                               |
| **30** | Allowlist de imágenes remotas                                                                                          | `next.config.mjs` + smoke de release                                 | El wildcard HTTPS se sustituye por `masterled.es` y `placehold.co`, los dos hosts presentes en 1452 productos activos; el smoke exige ambos y rechaza un host ajeno.                                                                                                                          |
| **31** | ISR del catálogo público                                                                                               | `src/lib/supabase/public.ts` + páginas públicas                      | Las lecturas sin sesión ya no llaman a `cookies()`: home, colecciones y tiendas usan ISR de 60s; sitemap usa ISR diario y las lecturas request-time declaran `no-store`. `/explore` mantiene respuesta dinámica por su paginación, compartiendo Data Cache durante 60s.                       |
| **32** | SEO de hubs públicos                                                                                                   | metadata de `/explore/[niche]` y `/store/[slug]`                     | Cada nicho y tienda indexable publica título/descripción propios, canonical estable y tarjetas Open Graph/Twitter; slugs inválidos declaran `noindex` y el smoke live cubre los dos tipos de página.                                                                                          |
| **33** | Tiendas activas en sitemap                                                                                             | `src/app/sitemap.ts` + smoke de release                              | Los cuatro perfiles reales pasan a ser descubribles por buscadores con `lastModified`; el filtro `active=true` evita reactivar merchants placeholder y el smoke exige Masterled en el XML.                                                                                                    |
| **34** | Copy factual de procedencia                                                                                            | PDP + `SITE_CONFIG.description`                                      | La PDP deja de presentar el país de la marca como origen del envío, deriva logística/devoluciones al merchant y el smoke impide que reaparezca esa afirmación; la descripción global ya incluye iluminación.                                                                                  |
| **35** | Alertas seguras por moneda                                                                                             | migration + evaluator + worker + cuenta                              | `baseline_currency` y `reference_currency` acompañan cada precio; cambios de divisa reinician alertas relativas, desactivan targets fijos y bloquean emails con moneda obsoleta. El preflight exige las columnas nuevas y el upgrade de borradores omite entregas ambiguas.                   |
| **36** | Facetas de búsqueda por nicho                                                                                          | `getSearchEcoFacets()` + `/search`                                   | Iluminación muestra filtros con cobertura real (`long-lifespan`, `recyclable`, `certified`) en vez de chips de moda; los labels son legibles y cualquier tag activo válido permanece visible al cambiar de nicho.                                                                             |
| **37** | Retorno contextual del comparador                                                                                      | selección + `/compare`                                               | El enlace conserva de forma saneada la búsqueda, filtros, orden y página de origen; quitar productos mantiene ese contexto y los CTAs de tienda abren otra pestaña para no destruir la comparación.                                                                                           |
| **38** | Catálogo completo por merchant                                                                                         | filtro `store` + perfil de tienda                                    | La ficha conserva ISR y muestra el total real; si supera las 36 cards iniciales enlaza a `/search?store=…`, cuyo slug está validado, se conserva en filtros/paginación y nunca mezcla otros merchants.                                                                                        |
| **39** | Saneado de enlaces + piloto Rapanui                                                                                    | auditor + ingestor curado                                            | 11 fixtures no-Masterled con placeholder se pusieron fuera de stock y 3 tiendas vacías se desactivaron sin borrar datos. Rapanui queda activo con 12/12 PDPs, stock y precios GBP verificados e imágenes enlazadas desde el CDN de origen; dry-run, allowlists y límites cubiertos por tests. |
| **40** | Piloto Oakywood vía Shopify UCP                                                                                        | `src/lib/feeds/oakywood.ts` + ingestor                               | 10 IDs curados consultados en una sola operación UCP con contexto España/EUR: 10/10 stock, destino e imagen 200. Hotlink restringido a su carpeta Shopify CDN; sin scraping de HTML. La UI distingue además eco-score 0 de “sin evaluar”.                                                     |
| **41** | Piloto ShiftCam + runner Shopify UCP común                                                                             | `src/lib/feeds/shiftcam.ts` + `scripts/lib/curated-shopify-ucp.ts`   | 10 accesorios de fotografía móvil en EUR: 10/10 stock, destino e imagen 200. ShiftCam usa eco-score 0/sin evaluación, advierte importación y restringe su carpeta CDN. Oakywood migra al mismo runner de lookup/dry-run/upsert.                                                               |
| **42** | Schema Cloud de histórico y alertas                                                                                    | migrations 0001/0002/20260728190000 + tipos remotos                  | Historial reconciliado y migraciones aplicadas en Supabase Cloud: click attribution, 1.613 snapshots baseline, RLS/policies/triggers/índices verificados y tipos TypeScript regenerados; 58 tests y build pasan.                                                                              |
| **43** | Google OAuth + perfiles E2E                                                                                            | Supabase Auth config + `/api/auth/*` + `/account`                    | Site URL HTTPS, allowlist y provider Google configurados; PKCE Shopifind→Supabase→Google verificado. Una identidad Google quedó vinculada a un perfil existente, con escritura persistente tras logout/login y sin duplicar usuario.                                                          |
| **44** | SMTP Auth + magic link cross-device                                                                                    | `636f5ee` + Hestia/Supabase config                                   | `acceso@auth.shopifind.app` con STARTTLS; SPF, DKIM 2048 y DMARC pasan en Proton. `TokenHash` se muestra en una landing no consumidora y sólo el POST verifica: PC→móvil E2E, 63 tests, build y smoke 17/17.                                                                                  |
| **45** | Primer refresh Masterled controlado                                                                                    | `/api/cron/refresh-masterled`                                        | Feed de 1.562 filas procesado en producción: 9 altas, 14 cambios de stock (1 entrada/13 salidas), 0 cambios de precio/moneda y 23 snapshots. Quedan 1.438 Masterled activos; 2 alertas intactas, 0 entregas y smoke 17/17.                                                                    |
| **46** | Schedule diario de catálogo                                                                                            | `40ddcb2` + `vercel.json`                                            | Sólo `/api/cron/refresh-masterled`, a las 03:15 UTC. Deployment aceptado, sitemap actualizado a 1.483 URLs y smoke 17/17; el worker de emails no se programa hasta verificar Resend.                                                                                                          |
| **47** | Exportación y borrado autoservicio                                                                                     | `da50273` + migration `20260729143000`                               | Export JSON paginado, privado y no-store; hard-delete sólo del usuario autenticado tras escribir su email. Cloud E2E: Auth/perfil/búsqueda 1/1/1 → 0/0/0; cookie posterior recibe 401. Live y smoke 18/18; 68 tests y build pasan.                                                            |
| **48** | Resend E2E + schedule diario de alertas                                                                                 | fixture oculto + `vercel.json`                                       | El intento con clave antigua falló sin perderse; tras rotarla, el mismo asiento fue `sent` en el intento 2 con provider ID y cursor a 90 EUR. La repetición envió 0 emails. Worker declarado a las 04:15 UTC, una hora después del catálogo.                                                   |
| **49** | Línea base analítica limpia + Plausible actualizado                                                                     | `c72571f` + `docs/analytics-operations.md`                            | Deployment aceptado y smoke 18/18: `search_history` permaneció exactamente en 167 filas antes/después, probando que el runner ya no contamina métricas. Eventos humanos nuevos usan `schema_version=2`; Plausible espera la URL `pa-…js` específica del sitio.                           |
| **50** | Cobertura pública 4/4 por nicho                                                                                         | `82b0d7c` + migration `20260729151000`                               | Oakywood pasa a `home-deco`, encaje más fiel para organización/mobiliario de escritorio; ShiftCam conserva gadgets. Migración registrada en Cloud, hubs muestran 10 productos cada uno y deployment/smoke 19/19 verificados.                                                           |
| **51** | Readiness de Google Search Console                                                                                      | `docs/search-console-launch.md`                                      | Robots y sitemap live revalidados: referencia canónica y 1.483 URLs absolutas. Alta DNS, envío, muestra de inspección y seguimiento quedan documentados; la propiedad y el submit siguen siendo una acción manual del owner.                                                         |

### Métricas post-deploy

| Métrica                                               | Valor                                                                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Tiendas históricas en seeds/DB                        | permanecen en DB; sólo **4 merchants saneados** están expuestos públicamente (`masterled-es`, `rapanui`, `oakywood`, `shiftcam`) |
| Productos activos en DB                               | **1470** (1438 Masterled + 12 Rapanui + 10 Oakywood + 10 ShiftCam; snapshot DB 2026-07-29)                                       |
| Nichos activos                                        | **4**                                                                                                                            |
| Nichos con inventario público                         | **4/4** (Rapanui · ShiftCam · Oakywood · Masterled)                                                                               |
| Colecciones publicado = true                          | **4**                                                                                                                            |
| `<loc>` URLs en sitemap.xml                           | **1483 live** (1 home + 4 explore + 4 stores + 4 collections + 1470 productos; verificado tras deploy 2026-07-29)                |
| HTTP 200 en smoke                                     | 100% de rutas navegables                                                                                                         |
| `pnpm test` / `pnpm exec tsc --noEmit` / `pnpm build` | 70/70 · rc=0 · rc=0                                                                                                              |
| `pnpm audit` completo                                 | **0** vulnerabilidades (runtime y dev; 0 low/moderate/high/critical; snapshot 2026-07-28)                                        |
| `pnpm smoke:production`                               | **19/19** contra `shopifind.app` (snapshot 2026-07-29)                                                                           |
| CLS / LCP / Lighthouse mobile (rough)                 | Home en 78 mobile / 92 desktop · LCP ≈1.8s                                                                                       |

---

## 9. Memoria práctica (gotchas que aprendimos y NO debemos repetir)

### Infra / Vercel

1. **Vercel silent rollback**: si `pnpm build` rompe después de un commit, Vercel no falla loudly — promotes la versión anterior cacheada. **Por eso cada push va seguido de un `curl <URL>` smoke test.** Confiar en el commit hash ≠ saber qué versión está viva.
2. **pnpm 11 build scripts y overrides**: usar la versión fijada por `packageManager` (`corepack pnpm …` si el binario global difiere). `allowBuilds`, `overrides` y `minimumReleaseAgeExclude` viven en `pnpm-workspace.yaml`; no volver a añadir `pnpm.onlyBuiltDependencies` a `package.json`, porque pnpm 11 lo ignora. Los overrides de `postcss`, `sharp` y el `brace-expansion` transitivo cierran advisories; validar siempre lint/build y `/_next/image` tras cambiarlos.
3. **Region `fra1`**: DB en lituania + Vercel en Frankfurt. Round-trip ~30ms. Si añades region `iad1` (US east), dobla latencia para usuarios EU.
4. **Cron en Vercel Hobby**: admite hasta 100 cron jobs por proyecto, pero cada job sólo puede ejecutarse una vez al día y puede dispararse en cualquier momento de la hora indicada. Para el objetivo de alertas cada 12h hace falta Pro u otro scheduler; ver `docs/cron-pattern.md`.

### Supabase / Postgres

5. **PostgREST 1000-row hard cap**. `Range: 0-9999` NO funciona — server enforcea el cap independientemente. **Solución única**: chunked loop client-side (ver `src/app/sitemap.ts` PAGE_SIZE=1000, MAX_PAGES=100).
6. **RLS + service-role key**: server actions que usen service-role key bypassean RLS. **Por eso siempre** en webhooks/cron: validar el payload con Zod antes de insert; nunca confiar en anon-key-write.
7. **Vistas y RLS**: la view `v_products_with_store` corre con permisos de `postgres`, NO del caller — el RLS de las tablas subyacentes NO se aplica sobre la vista. Si filtras por `in_stock = TRUE` en la view, hazlo explícito en la query (no confíes en RLS).
8. **Count=exact**: `select(..., {count: 'exact'})` PostgREST devuelve el total real. Para 1452 rows, dos queries (count + range) son ~250ms. Si necesitas scale >50k, migra a Materialized View con counters en `stores.updated_at`.
9. **GIN + tsvector**: rebuild del FTS tras un `seed-lighting-v1` largo tarda ~8s para 1452 rows. No es problema, pero no lo invoques cada deploy.

### Next.js / SEO

10. **Paginación acotada a 100 páginas**: todas las rutas usan el offset real y normalizan inputs; no volver a usar `Math.min(offset, 1000)`, porque repetía la misma tanda en páginas profundas. Si el catálogo supera esa ventana, migrar a cursor pagination.
11. **`/sitemap.xml` revalidate=86400**: no es un cron; se regenera bajo demanda como máximo una vez al día. El TTL de la ruta y el de sus lecturas Supabase deben permanecer sincronizados. Después de una alta/baja deliberada, verificar el XML live antes de enviarlo a GSC; para un release urgente puede bajarse temporalmente el mismo constante, desplegar, validar y restaurar el valor diario.
12. **`<loc>` debe ser absolute URL** (sitemap protocol). `SITE_CONFIG.url.replace(/\/+$/, '')` quita trailing slash antes de concatenar.
13. **canonical + og:url** en `metadata` de cada page export → consolidación de signals en GSC + share cards correctas en Twitter/LinkedIn/Facebook.
14. **`dangerouslyAllowSVG: true`** sigue temporalmente por covers editoriales legacy de `placehold.co`; los productos públicos ya no pueden usar placeholders. Masterled sirve imágenes raster, Rapanui usa `images.podos.io`; Oakywood y ShiftCam tienen carpetas exactas separadas en `cdn.shopify.com`. Retirar host + flag cuando se reemplacen esos covers.
15. **`SEARCH` bloqueado en robots.txt** porque `?q=*&niche=*&tag=*&page=*` genera infinite permutation → crawler trap.
16. **Middleware con `src/app`**: el archivo activo es `src/middleware.ts`. Una copia en la raíz puede compilar sin proteger rutas en este layout; comprobar siempre `/wishlist` anónimo (307) y una ruta lookalike (no redirect).
17. **APIs dinámicas de Next 15**: `cookies()`, `params` y `searchParams` son asíncronas. `createServerSupabaseClient()` devuelve una promesa y todos sus consumidores deben hacer `await`; un reemplazo incompleto puede compilar partes del árbol y fallar sólo en una ruta dinámica.
18. **Cliente Supabase público vs. sesión**: las lecturas de catálogo sin identidad usan `createPublicSupabaseClient()` para permitir Data Cache/ISR. Auth, perfiles, wishlist y alertas siguen usando `createServerSupabaseClient()`; usar el cliente público ahí ignoraría la sesión. En rutas dinámicas de búsqueda, comparación y `/go`, pasar `{ revalidate: false }` para no servir decisiones request-time desde caché.
19. **Precio sin moneda no es una referencia**: `baseline_price_cents` siempre viaja con `baseline_currency`, y el outbox congela ambos. Si cambia la moneda, no convertir ni comparar enteros directamente; los targets fijos se desactivan y los modos relativos adoptan el nuevo precio como baseline.

### Affiliate / Skimlinks

18. **`xcust=shopifind-<slug>` es la palanca de atribución**. Tiene que ser único por producto. Si dos slugs generan el mismo xcust, los reportes de Skimlinks los confunden.
19. **Bloquear `/go/` en robots.txt** — **obligatorio**. Sin esto, Googlebot ejecuta el 302 como click válido, infla las comisiones "visit" en el dashboard y distorsiona el funnel.
20. **Skimlinks no usa loader cliente**: `/go/<slug>` construye en servidor un 302 hacia `go.redirectingat.com` cuando existe `SKIMLINKS_DOMAIN_ID`; si falta, degrada a `affiliate_url` y luego a `source_url`. La cuenta/publisher sigue pendiente de aprobación y no debe describirse como monetización verificada.
21. **`/go/[id]` degrada con seguridad**: si falta `SKIMLINKS_DOMAIN_ID` usa `affiliate_url` y después `source_url`; el route param se llama `id` por historia, pero contiene el slug.

### Masterled / PrestaShop

22. **masterled.es NO expone `products.json`** — PrestaShop 1.6 con módulo `mlexportproducts` que sirve **CSV solo via token firmado** (`/module/mlexportproducts/export?token=…`). Cache CSV por 30 min en su origin; nuestro ingest respeta ese TTL.
23. **CSV delimitador `;`** + encoding `UTF-8 with BOM`. El parser de `seed-lighting-v1.ts` trim BOM antes de split.
24. **Slugs se normalizan**: `normalize('NFD').replace(/\p{Diacritic}/gu,'')` + `[^\w\s-] → '-'` → lowercase → strip leading/trailing hyphens. Sin esto, masterled "Bombilla LED GU10 5W" generaría slug roto.

### Revisión / proceso propio

25. **Cambios mecánicos**: al reemplazar un bloque, revisar también consumidores y referencias. Ejecutar `pnpm test`, typecheck, build y `git diff --check`; el typecheck por sí solo no detecta fallos de comportamiento.
26. **Verificación post-deploy**: esperar el estado `success` de Vercel y ejecutar `pnpm smoke:production`; descubre una PDP desde el sitemap y valida rutas, auth, SEO, imágenes, Skimlinks, cron y APIs de test sin secretos. El hash enviado a Git no demuestra por sí solo qué versión está sirviendo el dominio.
27. **Preflight de tablas PostgREST**: no usar `select(..., { head: true })` para comprobar que una tabla existe; puede devolver 204 aunque falte del schema cache. Usar un GET acotado con `.select('id').limit(1)` y comprobar `error`.
28. **Alta segura de merchants con imágenes remotas**: desplegar primero el `remotePatterns` exacto y mantener la tienda inactiva; comprobar en producción una URL real de `/_next/image` (incluido el ancho mayor usado por la UI) y sólo entonces activar la tienda. Como el sitemap usa ISR diario, tras activarla hay que provocar/verificar una regeneración con la tienda ya activa antes de dar el release por cerrado. Si falla el optimizador, desactivar la tienda es el rollback reversible: no se borran productos.
29. **Magic links y PKCE cross-device**: `ConfirmationURL` queda ligado al verificador del navegador que pidió el enlace y falla si se abre en otro dispositivo. Auth email usa `TokenHash` con una landing GET que no verifica nada y un POST explícito a `verifyOtp({type: 'email'})`; no volver a consumir tokens en GET porque los filtros de correo precargan enlaces.
30. **Separación de correo**: Supabase Auth envía por `mail.shopifind.app:587` como `acceso@auth.shopifind.app`; SPF, DKIM y DMARC están aislados en el subdominio. Las alertas usan Resend: su idempotency key complementa el ledger y el E2E confirmó recuperación tras fallo sin duplicado; sustituirlo por SMTP puro reabriría esa ventana.
31. **No medir el smoke como usuario**: `scripts/smoke-production.ts` usa `shopifind-release-smoke/1.0` y la capa de escritura lo excluye. Los eventos fiables llevan `filters.schema_version=2`; los 167 anteriores mezclan comprobaciones internas y posible tráfico real, por lo que no son una línea base de conversión.
32. **Plausible usa snippet único**: desde octubre de 2025 no basta `data-domain` + `/js/script.js`. Copiar el `pa-…js` concreto del sitio a `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC`; el layout sólo acepta ese host/formato y ejecuta `plausible.init()` una vez.

---

## 10. Backlog actualizado (orden de ejecución)

### 🔴 Acciones externas del owner (no requieren código)

| #       | Item                                       | Estado / efecto                                                                                                                                                                                               |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M-1** | ✅ **Completar Supabase Auth**             | Google OAuth/perfiles y magic link E2E completados. SMTP propio de marca, autenticación DNS y flujo cross-device resistente a prefetch verificados en producción.                                             |
| **M-2** | **Submit sitemap a Google Search Console** | El sitio está listo: robots + 1.483 URLs live verificados. Registrar la propiedad de dominio, mantener el TXT DNS y enviar el XML siguiendo `docs/search-console-launch.md`.                                  |
| **M-3** | **Conectar webhook Skimlinks**             | Configurar secret, salt y CIDRs en Vercel; registrar `/api/webhooks/skimlinks` en Skimlinks y enviar evento de prueba. El receiver ya existe.                                                                 |
| **M-4** | **Completar identidad legal y privacidad** | El sitio live aún usa scaffolds. Facilitar/decidir los datos y bases de `docs/launch-compliance-checklist.md` antes de escalar tráfico, AdSense o newsletters.                                                |
| **M-5** | **Fijar presupuesto de OpenAI**            | En el proyecto API de producción: alertas de gasto + hard spend limit mensual. El código ya tiene caché, telemetría y `OPENAI_SEARCH_ENABLED=false`; falta el tope externo que impida una factura inesperada. |

### 🟠 Desarrollo inmediato (por dependencias)

| #       | Item                                             | Bloqueado por                                   | Alcance                                                                                                                                       |
| ------- | ------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **B-1** | ✅ **Completar `/account` + profiles**           | nada                                            | Lectura, escritura, persistencia y relogin probados con una sesión Google real; identidad vinculada al perfil existente sin duplicado.        |
| **B-2** | ✅ **Modelo relacional de precios y alertas**    | nada                                            | Aplicado en Cloud: schema, trigger, RLS, ledger idempotente, 1.613 snapshots baseline y tipos regenerados/verificados.                        |
| **B-3** | ✅ **Refresh incremental + snapshots de precio** | nada                                            | Manual auditado y schedule diario 03:15 UTC declarado: 1.562 filas actuales, 23 snapshots correctos y sin alertas falsas.                     |
| **B-4** | ✅ **Alertas de bajada**                         | nada                                            | UI/evaluator/outbox, Resend E2E e idempotencia verificados; cron diario 04:15 UTC declarado. Sólo queda confirmar recepción y limpiar el fixture temporal. |
| **B-5** | ✅ **Corregir AI search actual**                 | nada                                            | Contrato corregido y E2E verificado en Vercel; se mantiene `gpt-4o-mini` por rol de extracción/coste en vez de migrar ciegamente a flagship.  |
| **B-6** | ✅ **Comparador manual MVP**                     | nada                                            | Selección de 2-5 cards → `/compare?ids=...`, `noindex`, columnas por producto y CTA `/go`. No afirma “mismo producto”; smoke live completado. |
| **B-7** | 🟡 **Segundo merchant de iluminación**           | verificación Skimlinks + feed/permiso del owner | Spike completado: GreenIce recomendado, Barcelona LED fallback. No ingestar hasta superar los gates de `docs/merchant-sourcing-lighting.md`.  |
| **B-7A** | 🟡 **Segundos merchants en los otros nichos**    | selección del owner + verificación Skimlinks    | Ronda 3 lista: Woodendot → Thinking MU → Native Union. Todos con UCP/agent contract; debatir y aprobar antes del piloto (`docs/merchant-sourcing-round-3.md`). |

### 🟡 Después del núcleo

| #        | Item                                                  | Nota                                                                                                                                                       |
| -------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B-8**  | **Comparación automática cross-store**                | Requiere segundo merchant y una estrategia explícita de matching/canonical SKU.                                                                            |
| **B-9**  | **Embeddings / similarity search**                    | Sólo después de medir la búsqueda estructurada corregida; estimar coste y latencia con datos reales.                                                       |
| **B-10** | ✅ **Ocultar merchants/URLs placeholder**             | Sólo cuatro merchants saneados están activos; las rutas placeholder históricas no aparecen en catálogo ni sitemap. Sustituir/reactivar sólo tras sourcing. |
| **B-11** | ✅ **Restringir `/api/test/*`**                       | Ya existe gate absoluto de producción y ambas rutas devuelven 404 en live.                                                                                 |
| **B-12** | **AdSense**                                           | `/search` está bloqueado en robots; no describirlo como página indexable. Esperar tráfico y revisar CWV/UX.                                                |
| **B-13** | Gift finder, featured stores, newsletter, marca EUIPO | Expansión una vez medidos search → PDP → click-out y retención.                                                                                            |

### 📋 Deuda recurrente

- Generar `database.types.ts` después de cada migration.
- Mantener tests de redirects, wishlist y atribución; añadir tests a cada nuevo handler de cron.
- Revisar el loader inline de Skimlinks y su impacto CWV cuando haya métricas reales.
- Documentar el scheduler elegido y su autenticación en `docs/cron-pattern.md`.

---

## 11. Operativa / cómo trabajar con esto

### Setup local (TL;DR)

```bash
git clone https://github.com/muraxbl/shopifind
cd dropifind
cp .env.example .env.local  # rellenar Supabase URL + anon + service-role
pnpm install
pnpm dev                    # http://localhost:3000

# cosas adicionales que querrás
pnpm test                   # node:test sobre tests/*.test.ts
pnpm check                  # lint + tests + typecheck, sin prompts
pnpm typecheck              # tsc --noEmit
pnpm smoke:production       # smoke read-only contra https://shopifind.app
pnpm scripts:seed:collection
pnpm scripts:seed:products
pnpm scripts:seed:lighting
pnpm scripts:seed:oakywood       # Shopify UCP; dry-run por defecto
pnpm scripts:seed:shiftcam       # Shopify UCP; dry-run por defecto
pnpm scripts:fix:urls       # corregе source_urls broken (chromium Playwright opcional)
pnpm scripts:hide:placeholder  # marca .example.com como live=false
```

### Convenciones del repo

- **`pnpm exec tsc --noEmit` antes de commit** — siempre.
- **Server Actions en `src/actions/` llevan `'use server'`** — no pongas lógica de DB en page components.
- **El nombre de archivo de migration debe seguir `YYYYMMDDHHMMSS_<snake>.sql`** (estándar Supabase CLI).
- **Url-routes SEO-friendly deben usar `generateStaticParams` cuando aplique** (collections, store profiles).
- **Variables de entorno SOLO env-typed via `process.env.NEXT_PUBLIC_*` o `src/lib/env.ts`** — no leas `process.env` ad-hoc en componentes.

### Cómo añadir un nuevo nicho (receta de 5 minutos, gracias al DRY-up)

1. **`src/lib/config.ts`**: añade `'mi-nuevo-niche'` a `primaryNiches`, y añade label/emoji/tagline en `NICHE_LABEL`.
2. **`supabase/migrations/YYYYMMDDHHMMSS_add_mi_nuevo_niche.sql`**: `INSERT INTO niches … ON CONFLICT DO NOTHING`.
3. **`scripts/seed-products-v2.ts`**: agrega el seed block para tu merchant.
4. **Deploy Vercel** (auto al push). Ya renderiza `/explore/mi-nuevo-niche`, en home aparece como chip, en sidebar de /search aparece en NICHE_FACET, y `/sitemap.xml` lo incluye en su siguiente regeneración diaria; si forma parte del release SEO, seguir el procedimiento urgente del gotcha 11.

### Cómo rotar las Skimlinks publisher keys

1. Crea nuevo publisher en https://hub.skimlinks.com/.
2. Update `SKIMLINKS_DOMAIN_ID` en `.env.local` + Vercel env.
3. New build → nuevas URLs `go.redirectingat.com/?id=<NEW_DOMAIN_ID>`. **Importante**: el publisher viejo sigue attributable al `xcust=shopifind-<slug>` durante ~90 días (Skimlinks retention window). No hay cut-over abrupto.

### Cómo debuggear un deploy que no refleja el último commit

```bash
# 1. ¿Vercel está vivo?
curl -I https://shopifind.app              # 200?

# 2. ¿Cuál commit está sirviendo?
curl -sS https://shopifind.app | grep -oE '__NEXT_DATA__' | head -1
# → si NO hay __NEXT_DATA__ markup, el deploy es estático-only o rolled-back

# 3. Forzar invalidación de ISR
curl -H 'Cache-Control: no-cache' https://shopifind.app/sitemap.xml?nocache=$(date +%s)

# 4. ¿Hay errores de runtime?
# Mira el dashboard Vercel > Logs > Runtime Errors.
```

### Glosario (jerga interna)

- **chips** — los badges verdes/little icons que se ven en product card (vegan, eu-made, recycled, …).
- **capsule / capsule editorial** — `editorial_collections` row, ej. `ethical-staples`, `verano-techos-led`.
- **dry-run vs write** — todos los scripts `seed-*` aceptan `--dry-run` (no insert, sólo report) y `--write` (commit a DB). Patrón: dry-run primero, leer el plan, luego write.
- **Ventana de paginación** — máximo 100 páginas con offset real; si el catálogo crece más allá, sustituir por cursores en vez de reintroducir un offset truncado.
- **Skylinks / Skimlinks** — typos que nos han salido; la grafía correcta es **Skimlinks**.

---

## 12. Pendientes manuales que el owner (tú) tiene que hacer

- [x] Supabase Auth: Google + perfil y magic link SMTP/`TokenHash` cross-device E2E verificados el 2026-07-29; SPF, DKIM y DMARC pasan.
- [x] Google OAuth: cliente web, callback Supabase, provider, PKCE, sesión, perfil y persistencia E2E verificados el 2026-07-29.
- [ ] Google Search Console: registrar la propiedad de dominio `shopifind.app` (sin protocolo) → mantener el TXT DNS → Sitemaps > Add → `https://shopifind.app/sitemap.xml`; registrar el resultado siguiendo `docs/search-console-launch.md`.
- [ ] Bing Webmaster Tools (opcional pero gratis): mismo proceso.
- [ ] Plausible analytics: crear/verificar `shopifind.app`, copiar su URL
  `https://plausible.io/js/pa-….js` a `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC` en
  Vercel y completar el E2E de `docs/analytics-operations.md`.
- [ ] OpenAI: configurar alertas de gasto y hard spend limit en el proyecto API de producción (`docs/ai-search-operations.md`).
- [ ] Legal/privacidad: proporcionar identidad pública, NIF, domicilio/datos registrales si aplican, bases y retenciones; completar `docs/launch-compliance-checklist.md` antes de activar más tracking o adquisición.
- [ ] Confirmar el eco-score `78` para masterled con curación humana (es el único valor auto-asignado en el seed; el resto vieram del seed.sql).
- [ ] Rotar el `SKIMLINKS_DOMAIN_ID` placeholder en `.env.local` (real key ya está en Vercel env, ¿OK?).
- [ ] Segundo merchant iluminación: comprobar primero GreenIce y después Barcelona LED en el dashboard real de Skimlinks; sólo entonces solicitar/usar un feed autorizado (`docs/merchant-sourcing-lighting.md`).
- [ ] Skimlinks: comprobar `oakywood.shop`, `rapanuiclothing.com` y `shiftcam.com`; Oakywood y Rapanui siguen `verified=false` hasta confirmar deep-link/monetización en la cuenta real.

---

## 13. TL;DR one-liners para una nueva persona en el proyecto

- **¿Qué es esto?** Buscador D2C de tiendas indie en 4 verticales · busca conversacional con IA · monetiza con Skimlinks affiliate.
- **¿Dónde corre?** Vercel EU Frankfurt + Supabase Cloud. Domain `shopifind.app`.
- **¿Cómo se cambia un nicho?** Editar `src/lib/config.ts → primaryNiches + NICHE_LABEL`. Vercel auto-redeploy.
- **¿Cómo se añade un producto?** Vía `pnpm scripts:seed:products` (multi-merchant) o `pnpm scripts:seed:lighting` (masterled) → usar `--dry-run` primero.
- **¿Cómo se mide?** Plausible (setup pendiente de verificar) + `click_attribution`; el receiver existe, falta conexión y prueba E2E con Skimlinks.
- **¿Cuál es el siguiente milestone live pendiente?** Enviar el sitemap ya validado a GSC, completar identidad legal y validar el segundo merchant en Skimlinks; el núcleo de alertas ya está operativo.

---

_Este documento es la memoria viva. Si añades un milestone que cambia la arquitectura, edita este archivo en el mismo commit. Convencional: nombre `HANDOFF.md`, sección nueva al final de "Resumen de lo realizado" antes de los gotchas._
