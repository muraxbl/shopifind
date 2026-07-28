# Shopifind — Handoff del proyecto

> Documento vivo. Última actualización: 2026-07-28. **Estado:** MVP live en `shopifind.app` (Vercel) con DB poblada en Supabase Cloud. 4 nichos curados · 7 stores documentadas · 1452 productos activos expuestos · 4 colecciones editoriales · sitemap.xml + robots.txt operacionales.

---

## 1. TL;DR

| | |
|---|---|
| **Qué es** | Buscador B2C de tiendas independientes reales. Indexa 4 nichos curados (sustainable-fashion, indie-gadgets, home-deco, **iluminacion**), permite búsqueda conversacional con IA, wishlist universal cross-store. |
| **Quién monetiza** | Affiliate (Skimlinks publisher `306854X1795120`). CTR al merchant → join transaction automático vía JS loader. Comparador manual live; Display AdSense planned. |
| **Stack core** | Next.js 14 (App Router) · TypeScript · Supabase (Postgres + Auth + RLS) · Vercel (region `fra1`) · Skimlinks · Resend · OpenAI · Plausible · Tailwind + shadcn/ui |
| **Live URL** | https://shopifind.app |
| **Status** | MVP público. Ingest masiva en iluminación completada (masterled.es, 1563 productos · 1452 in-stock). |

---

## 2. ¿Qué es Shopifind y para qué se creó?

### Concepto

> **Less Amazon, more you.** Personal shopper digital que indexa tiendas independientes D2C en nichos curados, **no marketplaces**. Target: shopper europeo 25-45 que sabe lo que le importa (sostenibilidad, maker local, ética) pero no quiere pasar 2h buscando entre 100 opciones de AliExpress.

### Por qué existe (3 problemas que resuelve)

1. **Descubrimiento vs. búsqueda**: cuando ya sabes qué tienda quieres, vas directo. Cuando sabes qué *te importa* pero no la tienda, comes tiempo muerto. Shopifind cataloga por *valores* (eco_score 0-100, `eco_tags[]`, país, certificaciones) — no solo por keyword.
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
│    Next.js 14 App Router  ·  ISR (revalidate=60s por ruta)          │
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
   │ SKIMLINKS  ·  pub  │ │ RESEND  ·  email │ │ OPENAI  ·  intent  │
   │ 306854X1795120     │ │ (planned per     │ │ gpt-4o-mini via    │
   │ go.redirectingat…  │ │  alertas MVP)    │ │ Structured Outputs │
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

| Capa | Tech | Versión | Comentario |
|---|---|---|---|
| Framework | **Next.js** App Router | 14.2.35 | RSC + Server Actions. `experimental.serverActions.bodySizeLimit = 2mb`. |
| Lenguaje | **TypeScript** | 5.4.5 | `strict` + `noUncheckedIndexedAccess`. Genera `.tsbuildinfo` cacheado. |
| UI | **Tailwind** + **shadcn/ui** + **Radix** + **Lucide** | 3.4 / latest | Radix primitives para dialog/popover/tabs/toast. shadcn wrapper. |
| Auth + DB | **Supabase** (`@supabase/ssr` + `supabase-js`) | ssr 0.12 / js 2.43 | Service-role key SOLO server-side. |
| AI | **OpenAI** (`OPENAI_SEARCH_MODEL`, default `gpt-4o-mini`) | 4.47 | Chat Completions + Structured Outputs. 4s timeout, sin retry, fallback literal. |
| Affiliate | **Skimlinks** (publisher `306854X1795120`) | — | `go.redirectingat.com` con `xcust=shopifind-<slug>`. |
| Email | **Resend HTTP API** (prepared) | REST | Builder HTML/text, idempotency key y sender preparados sin SDK; falta configuración y E2E real. |
| CRM email | **react-hook-form** + **zod** | 7.51 / 3.23 | Formularios de captura + validación. |
| Build | **tsx** (scripts), **pnpm** | 4.16 / 11.3 | Scripts en `/scripts/*.ts` corren vía `tsx`, no `next`. pnpm 11 lee permisos de builds en `pnpm-workspace.yaml`. |
| Testing | **playwright-core** (devDep) | 1.62 | Solo instalado si activamos Playwright para fix-source-urls SFCC. |

### Hosting

| Servicio | Plan | Región | Notas |
|---|---|---|---|
| **Vercel** | Hobby (auto-upgrade si Pro necesario) | `fra1` (Frankfurt) | `pnpm build` es el comando. Hobby admite hasta 100 cron jobs, pero cada uno como máximo una vez al día y con precisión horaria. |
| **Supabase Cloud** | Free tier → evaluar upgrade | EU region (default) | DB en lituania-eu-west; auth/pg_net/realtime listos. |

### Crons / scheduled jobs

> **Hoy:** endpoint seguro de refresh preparado, pero ningún schedule activo.
>
> **Pendientes** (backlog):
> - Activar refresh diario de Masterled después de aplicar B-2 y configurar secretos.
> - Scanner de precios 12h (price-alerts MVP).
> - Configuración externa + prueba end-to-end del webhook Skimlinks. El receiver y el INSERT ya están implementados.

---

## 5. DB schema

> 3 migraciones aplicadas conocidas + 1 migración preparada en `supabase/migrations/`:
> 1. `00000000000000_init.sql` (núcleo + RLS + view)
> 2. `00000000000001_click_attribution.sql` (target Skimlinks webhook)
> 3. `00000000000002_add_iluminacion_niche.sql` (cuarto nicho)
> 4. `20260728190000_price_history_alerts.sql` (**pendiente de aplicar en Cloud**)

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

#### `price_history` + `price_alerts` + `price_alert_deliveries` — preparado, no aplicado

La migración `20260728190000_price_history_alerts.sql` registra únicamente cambios reales de precio/stock mediante trigger, separa una alerta configurable por usuario-producto y añade un ledger de entregas con `UNIQUE (alert_id, price_history_id)` para impedir emails duplicados en reintentos. Incluye RLS owner-only para alertas, lectura pública del histórico y escrituras del ledger reservadas al service role. Falta dry-run/aplicación contra Supabase Cloud.

#### `editorial_collections` — cápsulas SEO

`product_ids UUID[]` (orden preserva → display order en grid). `published BOOLEAN`, `published_at TIMESTAMPTZ`. RLS: solo `published=TRUE` visible al público.

#### `click_attribution` — target del Skimlinks webhook

> Migración 0001 (idempotente) + receiver desplegado en `/api/webhooks/skimlinks`. Falta configurar credenciales/CIDRs en producción, registrar la URL en Skimlinks y validar un evento real.

- `xcust` (nuestro custom), `product_slug`, `source_url`, `merchant_id`.
- `intent` ENUM `'visit' | 'buys'` (los dos tipos que Skimlinks envía).
- `paid BOOLEAN`, `commission_cents INT`, `paid_at TIMESTAMPTZ`.
- `raw_payload JSONB`, `payload_timestamp TEXT` (para dedupe del retry).
- **UNIQUE INDEX dedupe**: `(xcust, intent, payload_timestamp)` — Skimlinks puede reenviar el mismo evento.
- **RLS admin-only read** (`auth.jwt() -> 'app_metadata' ? 'admin'`); service-role bypass para escribir desde webhook.

#### View `v_products_with_store`

Reune productos con 10 columnas de `stores` que el frontend lee (`store_name`, `store_slug`, `niche`, `country`, `eco_score`, `values`, `featured`, …). **Por qué existe**: payload <3KB por row (vs ≈12KB si joinamos `*`). Las page-queries (search/explore/PDP) hacen `SELECT … FROM v_products_with_store` con `count='exact'` para pagination.

### Seeds pre-cargados (lo que está en DB hoy)

| Tipo | Cantidad | Tabla | Origen |
|---|---|---|---|
| Stores seed | 6 | `stores` | `supabase/seed.sql` (everlane-eu, b-corp-outfitters, killiney-audio, gridloom, casa-vereda, nordic-folk) |
| Productos seed SF/IG/HD | 10 | `products` | `seed.sql` |
| Productos seed SF extra (ethical-staples) | 4 | `products` | `seed.sql` (extend para cápsula curated) |
| Productos masterled.es | 1452 (in-stock 1452) | `products` | `scripts/seed-lighting-v1.ts` (PrestaShop CSV feed) |
| **Cápsulas editoriales** | 4 | `editorial_collections` | `seed-editorial-collection.ts` + `seed-lighting-collections-v1.ts` |
| **Iluminación store** | 1 | `stores` | seed-lighting-v1.ts (masterled-es · niche = iluminacion · eco_score 78) |

---

## 6. Funcionalidades desplegadas (live en shopifind.app)

### UI / páginas

| Ruta | Status | Notas |
|---|---|---|
| `/` | ✅ live | Hero con AiSearchBox · 4 niche chips · 8 productos featured `last_seen_at DESC` · `<canonical>` + `og:url` apuntando a SITE_CONFIG.url. |
| `/explore/<niche>` | ✅ live | Paginación server-side (24/page, máximo 100 páginas) · chips de nicho · spotlight de colección (Cuando iluminacion → `verano-techos-led`). ISR `revalidate=60`. |
| `/search` | ✅ live | DRY-up facet (NICHE_FACET, 4 niches + "Todos") · AI intent parser · filtros sin texto · parámetros URL validados · pagination · selector de comparación. |
| `/collections/<slug>` | ✅ live | 4 colecciones (1 SF + 3 iluminación verano) · JSON-LD `ItemList` + `Product/ Offer` schema · rich snippets Google. |
| `/go/[id]` | ✅ live | Server-side 302 a Skimlinks con `xcust=shopifind-<slug>` · bloqueado en robots. |
| `/product/<slug>` | ✅ live | Canonical + Product/Offer JSON-LD seguro, compartir funcional, CTA afiliado, información de tienda, wishlist y alertas con fallback. |
| `/compare?ids=...` | ✅ live | Comparador manual de 2-5 productos, `noindex`, atributos normalizados, mejor precio sólo entre monedas iguales y CTA afiliado por producto; smoke E2E con dos filas reales. |
| `/wishlist` | ✅ live | Middleware gate + lista owner-only + corazones funcionales en cards/PDP; escritura usa datos autoritativos del producto. |
| `/account` | ✅ código listo | Perfil owner-only: nombre, preferencias de nicho, plan visible y logout local. Falta smoke E2E con sesión real tras corregir M-1. |
| `/login` + `/api/auth/callback` | ⚠ código live / config externa pendiente | Middleware protege `/wishlist`, `/account`, `/settings`; magic link necesita corregir redirects/plantilla en Supabase y Google requiere habilitar su provider. |
| `/sitemap.xml` | ✅ live | 1461 URLs verificadas el 2026-07-28. Sólo productos in-stock de stores activas. ISR `revalidate=3600`; loop 1000/page. |
| `/robots.txt` | ✅ live | Allow `/` + disallow `/api/`, `/admin/`, `/auth/`, `/go/`, `/search` + sitemap reference. |
| `/legal` / `/privacy` / `/about` | ✅ Markdown scaffold | Páginas-estatic SEO/disclaimer. |
| `/api/products/*` + `/api/auth/*` | ✅ implementado | Handlers server-side desplegados; los providers OAuth siguen dependiendo de configuración externa. |
| `/api/cron/refresh-masterled` | ✅ live / inactivo | Bearer auth, preflight real de `price_history`, feed allowlisted/acotado y guardias de integridad. Sin schedule ni secretos de activación; 401 anónimo verificado. |
| `/api/cron/process-price-alerts` | ✅ live / inactivo | Evaluator + outbox con claim, retries, skip de avisos obsoletos e idempotencia Resend. Sin schedule; 401 anónimo verificado; depende de B-2 y secretos Resend. |
| `/api/webhooks/skimlinks` | ⚠ receiver live / E2E pendiente | Valida tamaño, CIDR, HMAC, payload y replay; inserta con dedupe. Falta conectar Skimlinks y probar evento real. |
| `/api/test/*` | ✅ restringido | Gate default-deny y bloqueo absoluto en `NODE_ENV=production`; GET/POST verificados con 404 en `shopifind.app`. |

### Features cross-cutting

| Feature | Componente | Status |
|---|---|---|
| **AI conversational search** | `src/lib/ai/queryIntent.ts` + `src/actions/search.ts` | ✅ wired · fallback gracioso si no hay `OPENAI_API_KEY`. |
| **Server-side pagination** | `src/components/pagination/Pagination.tsx` | ✅ page size `[12, 96]`, máximo 100 páginas y offset real sin tandas repetidas. |
| **JSON-LD ItemList** | `src/app/(shop)/collections/[slug]/page.tsx` | ✅ validado Google Rich Results. |
| **Supabase Auth SSR refresh** | `src/middleware.ts` | ✅ smoke tested: anónimo en `/wishlist` recibe 307; rutas con prefijo parecido no quedan bloqueadas. |
| **Skimlinks affiliate redirect** | `src/app/go/[id]/route.ts` + `src/lib/skimlinks.ts` | ✅ publisher `306854X1795120`. |
| **Eco-score badges en cards** | `src/components/product/ProductCard.tsx` | ✅ muestra `store_eco_score` + `eco_tags[..n]`. |
| **Wishlist JSONB** | `src/actions/wishlist.ts` + `src/app/(shop)/wishlist/` | ✅ read/write · RLS owner-only · corazones reales y precio/URL resueltos server-side. |
| **Gestión de price alerts** | `src/actions/priceAlerts.ts` + PDP + `/account` | 🟡 tres modos, owner-only y cursor de baseline preparados; UI se auto-desactiva mientras B-2 falte. Worker/email listos pero inactivos. |
| **Pricing alerts email** | `src/lib/email/resend.ts` + `/api/cron/process-price-alerts` | 🟡 evaluator/outbox/sender preparados; falta migración Cloud, secretos, schedule y E2E real. |
| **Comparador manual** | `src/components/compare/CompareSelection.tsx` + `src/app/(shop)/compare/page.tsx` | ✅ picker de 2-5 cards y tabla comparativa sin afirmar equivalencia de modelo. La comparación automática fuerte en iluminación sigue necesitando otro merchant. |

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

Si OpenAI está caído, tarda más de 4s o schema validation falla → fallback literal. **URL params siempre ganan**, incluido `sort`. Las queries se limitan a 240 caracteres y los valores del `.or()` PostgREST se entrecomillan para que comas/paréntesis no alteren la gramática. `attributes` se retiró del intent hasta que exista ejecución SQL real para ese campo.

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
│   │   └── 20260728190000_price_history_alerts.sql  # preparado; NO aplicado aún
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
    │   ├── sitemap.ts                     # ← chunked loop, 1461 URLs
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
    │   ├── supabase/{server,client,admin}.ts
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
5. **`src/lib/supabase/server.ts`** — `createServerSupabaseClient()` (anon key con cookies del middleware).
6. **`next.config.mjs`** — `images.remotePatterns: ['**']` (wildcard para cualquier merchant HTTPS).
7. **`src/middleware.ts`** — `PROTECTED_PATHS` para extender gates. Con `src/app`, dejarlo en la raíz del repo no lo activa.

---

## 8. Resumen de lo realizado

### Cronología (milestones shipped)

| # | Milestone | Commit / artefacto | Resultado |
|---|---|---|---|
| **0** | Pivot a Supabase Cloud + bootstrap Next.js 14 | early seeds | DB en EU, anon + service role conectadas. |
| **1** | Schema + RLS + view + 6 stores seed | `seed.sql` | 6 merchants, 10 productos base, RLS saneada. |
| **2** | Editorial collection scaffolding (`editorial_collections` table + page JSON-LD) | migration 0000 + `/(shop)/collections/[slug]/` | ItemList schema listo para SEO launch. |
| **3** | Skimlinks `/go/[id]` redirect | `src/lib/skimlinks.ts` + `/go/[id]/route.ts` | publisher `306854X1795120` activo. |
| **4** | masterled.es ingest (lighting) | `scripts/seed-lighting-v1.ts` | **1452 productos in-stock del 1563 ingestados** (eco_score=78). |
| **5** | Seed extension SF ethical‑staples + lighting cápsula "verano-techos-led" | `seed.sql` extend + `seed-editorial-collection.ts` | Curación vertical + SEO entry point para iluminación. |
| **6** | Hardening pre-prod (`npm audit`) | reportado · upgrades safe-only | 0 critical vulnerabilidad (3 dev-deps sub-pinned that flagged). |
| **7** | Middleware Supabase SSR refresh | `src/middleware.ts` | auth cookie persist + gates /wishlist, /account, /settings. |
| **8** | Pagination + DRY-up facet | commit `e46139d` | offset pagination, NICHE_FACET unifica search + explore + home, SSR-safe. |
| **9** | JSON-LD ItemList schema en collection pages | `/(shop)/collections/[slug]/page.tsx` | Google Rich Results detectados y validan OK. |
| **10** | Deploy Vercel + dominio `shopifind.app` | vercel.json + env vars | Production URL activa. |
| **11** | `/sitemap.xml` + `/robots.txt` (Next 13+) | commit `4b171b9` (tras fix de orphan code block) | 1461 URLs · ISR 1h · block `/go/`, `/search`, `/api`, `/auth`, `/admin`. |
| **12** | canonical + og:url en `/` | `src/app/page.tsx` `metadata` export | consolida signal en GSC. |
| **13** | 3rd merchant SEO curation: `seed-lighting-collections-v1.ts` (verano-techos-led, exterior-solar, enchufes-deslizantes) | seed iluminacion v1 | 3 cápsulas curadas para verano 2026. |
| **14** | Domain final enlazado Vercel | `shopifind.app` | DNS A + TXT configured. |
| **15** | Auth/wishlist/PDP hardening + tests | `fcad59b`, `98189ff` | Redirects internos saneados, middleware activo en `src/`, wishlist real, datos autoritativos server-side, sitemap y `/go` excluyen catálogo inactivo; 7 tests y smoke live. |
| **16** | Account + profiles | `src/app/(shop)/account` + `src/actions/profile.ts` | `/account` owner-only, edición validada de nombre/nichos, plan visible, logout local, navegación responsive; 10 tests totales y build limpio. |
| **17** | AI search contract hardening | `src/lib/ai/queryIntent.ts` + `src/lib/search/postgrest.ts` | Iluminación soportada, tags catalog-backed, filtros puros, URL precedence, límite/timeout, escape PostgREST y fallback cubiertos; 16 tests y consulta read-only real validada. |
| **18** | Comparador manual MVP | `src/components/compare` + `/(shop)/compare` | Selección de 2-5 cards, URL validada y acotada, tabla `noindex`, atributos agrupados, comparativa de precios segura por moneda y CTAs `/go`; 19 tests totales y build limpio. |
| **19** | Search filter-only + URL hardening | `src/lib/search/input.ts` + `/(shop)/search` | Nicho/eco-tag/precio funcionan sin texto, enums y cifras se validan en runtime, eco-tag rápido respaldado por catálogo y toggle para limpiar; 21 tests totales. |
| **20** | Guarded Masterled refresh | `373d38d` | Parser único CLI/cron, 1.563 filas reales validadas, Bearer auth, preflight, lotes y stale-stock; endpoint live devuelve 401 y no tiene schedule. |
| **21** | Price-alert management UI | `src/actions/priceAlerts.ts` + `PriceAlertCard` + `PriceAlertList` | Tres modos validados, baseline/cursor autoritativos, PDP/cuenta y fallback honesto si falta schema. |
| **22** | Price-alert evaluator + idempotent sender | `/api/cron/process-price-alerts` + `src/lib/alerts/evaluate.ts` | Estado final del ciclo, outbox con claim/recovery, precio de referencia congelado, stale skip, Resend idempotency y HTML escapado; 33 tests totales. |
| **23** | Sourcing del segundo merchant de iluminación | `docs/merchant-sourcing-lighting.md` | GreenIce recomendado y Barcelona LED como fallback; catálogos públicos viables, pero cero SKU exactos cross-store. Ingest bloqueada hasta verificar Skimlinks y obtener feed/permiso. |
| **24** | Telemetría interna fiable | `src/lib/analytics/*` | Búsquedas y click-outs se escriben con cliente anónimo y operación esperada; eventos estructurados, total real y paginación. Plausible sigue sin configurar. |
| **25** | PDP SEO + share real | `src/lib/seo/jsonLd.ts` + `ShareButton` | Canonical/OG URL, Product/Offer con seller honesto, serialización anti-`</script>` y Web Share/clipboard; JSON-LD de colecciones corregido. |

### Métricas post-deploy

| Métrica | Valor |
|---|---|
| Tiendas históricas en seeds/DB | **7**; sólo **4 merchants reales** están expuestos públicamente |
| Productos activos expuestos por sitemap | **1452** (snapshot live 2026-07-28; el total físico en DB puede incluir seeds/inactivos) |
| Nichos activos | **4** |
| Colecciones publicado = true | **4** |
| `<loc>` URLs en sitemap.xml | **1461** (1 home + 4 explore + 4 collections + 1452 products) |
| HTTP 200 en smoke | 100% de rutas navegables |
| `pnpm test` / `pnpm exec tsc --noEmit` / `pnpm build` | 39/39 · rc=0 · rc=0 |
| CLS / LCP / Lighthouse mobile (rough) | Home en 78 mobile / 92 desktop · LCP ≈1.8s |

---

## 9. Memoria práctica (gotchas que aprendimos y NO debemos repetir)

### Infra / Vercel

1. **Vercel silent rollback**: si `pnpm build` rompe después de un commit, Vercel no falla loudly — promotes la versión anterior cacheada. **Por eso cada push va seguido de un `curl <URL>` smoke test.** Confiar en el commit hash ≠ saber qué versión está viva.
2. **pnpm 11 build scripts**: `allowBuilds` vive en `pnpm-workspace.yaml`; `true` permite el build del paquete y `false` lo bloquea. No volver a añadir `pnpm.onlyBuiltDependencies` a `package.json`, porque pnpm 11 lo ignora.
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
11. **`/sitemap.xml` revalidate=3600**: ISR funciona, pero si editas el código del sitemap **sin** esperar ISR, Googlebot verá la versión cacheada. Para forzar refresh: 1) redeploy, o 2) `curl -H 'Cache-Control: no-cache' https://shopifind.app/sitemap.xml?nocache=$(date +%s)`.
12. **`<loc>` debe ser absolute URL** (sitemap protocol). `SITE_CONFIG.url.replace(/\/+$/, '')` quita trailing slash antes de concatenar.
13. **canonical + og:url** en `metadata` de cada page export → consolidación de signals en GSC + share cards correctas en Twitter/LinkedIn/Facebook.
14. **`dangerouslyAllowSVG: true`** en `next.config.mjs` permite `placehold.co/...svg` — necesario porque masterled images llegan como SVG en el seed. CSP sandbox embebida evita ejecución de scripts.
15. **`SEARCH` bloqueado en robots.txt** porque `?q=*&niche=*&tag=*&page=*` genera infinite permutation → crawler trap.
16. **Middleware con `src/app`**: el archivo activo es `src/middleware.ts`. Una copia en la raíz puede compilar sin proteger rutas en este layout; comprobar siempre `/wishlist` anónimo (307) y una ruta lookalike (no redirect).

### Affiliate / Skimlinks

17. **`xcust=shopifind-<slug>` es la palanca de atribución**. Tiene que ser único por producto. Si dos slugs generan el mismo xcust, los reportes de Skimlinks los confunden.
18. **Bloquear `/go/` en robots.txt** — **obligatorio**. Sin esto, Googlebot ejecuta el 302 como click válido, infla las comisiones "visit" en el dashboard y distorsiona el funnel.
19. **Skimlinks JS loader**: si ad-blocker lo bloquea, el user va directo al merchant sin tracking. Aceptamos esa pérdida (es lo mismo que cualquier affiliate network, ~5-10% lost-to-blockers).
20. **`/go/[id]` degrada con seguridad**: si falta `SKIMLINKS_DOMAIN_ID` usa `affiliate_url` y después `source_url`; el route param se llama `id` por historia, pero contiene el slug.

### Masterled / PrestaShop

21. **masterled.es NO expone `products.json`** — PrestaShop 1.6 con módulo `mlexportproducts` que sirve **CSV solo via token firmado** (`/module/mlexportproducts/export?token=…`). Cache CSV por 30 min en su origin; nuestro ingest respeta ese TTL.
22. **CSV delimitador `;`** + encoding `UTF-8 with BOM`. El parser de `seed-lighting-v1.ts` trim BOM antes de split.
23. **Slugs se normalizan**: `normalize('NFD').replace(/\p{Diacritic}/gu,'')` + `[^\w\s-] → '-'` → lowercase → strip leading/trailing hyphens. Sin esto, masterled "Bombilla LED GU10 5W" generaría slug roto.

### Revisión / proceso propio

24. **Cambios mecánicos**: al reemplazar un bloque, revisar también consumidores y referencias. Ejecutar `pnpm test`, typecheck, build y `git diff --check`; el typecheck por sí solo no detecta fallos de comportamiento.
25. **Verificación post-deploy**: esperar el estado `success` de Vercel y hacer smoke contra `shopifind.app`; el hash enviado a Git no demuestra por sí solo qué versión está sirviendo el dominio.
26. **Preflight de tablas PostgREST**: no usar `select(..., { head: true })` para comprobar que una tabla existe; puede devolver 204 aunque falte del schema cache. Usar un GET acotado con `.select('id').limit(1)` y comprobar `error`.

---

## 10. Backlog actualizado (orden de ejecución)

### 🔴 Acciones externas del owner (no requieren código)

| # | Item | Estado / efecto |
|---|---|---|
| **M-1** | **Corregir Supabase Auth** | Site URL `https://shopifind.app`; allowlist del callback; plantilla magic link con `ConfirmationURL`. Google OAuth además requiere OAuth Client y provider habilitado. Bloquea el smoke E2E real de perfiles. |
| **M-2** | **Submit sitemap a Google Search Console** | Quick win manual: registrar dominio y enviar `https://shopifind.app/sitemap.xml`. |
| **M-3** | **Conectar webhook Skimlinks** | Configurar secret, salt y CIDRs en Vercel; registrar `/api/webhooks/skimlinks` en Skimlinks y enviar evento de prueba. El receiver ya existe. |
| **M-4** | **Completar identidad legal y privacidad** | El sitio live aún usa scaffolds. Facilitar/decidir los datos y bases de `docs/launch-compliance-checklist.md` antes de escalar tráfico, AdSense o newsletters. |

### 🟠 Desarrollo inmediato (por dependencias)

| # | Item | Bloqueado por | Alcance |
|---|---|---|---|
| **B-1** | ✅ **Completar `/account` + profiles** | M-1 sólo para E2E real | Código y validación completados; falta probar lectura/escritura con una sesión real después de corregir Supabase Auth. |
| **B-2** | 🟡 **Modelo relacional de precios y alertas** | aprobación/aplicación de migración | Schema, trigger, RLS, ledger idempotente y tipos preparados localmente; NO aplicado aún a Cloud. |
| **B-3** | 🟡 **Refresh incremental + snapshots de precio** | B-2 + secretos/schedule en Vercel | Handler, parser compartido, auth, guardias de feed, lotes y stale-stock preparados. No programado ni ejecutado contra Cloud. |
| **B-4** | 🟡 **Alertas de bajada** | B-2 + activar crons + secretos Resend | UI, tres modos, evaluator, outbox y sender idempotente preparados. Falta aplicar schema, configurar/ejecutar y completar E2E con email real. |
| **B-5** | ✅ **Corregir AI search actual** | nada | Contrato corregido y E2E verificado en Vercel; se mantiene `gpt-4o-mini` por rol de extracción/coste en vez de migrar ciegamente a flagship. |
| **B-6** | ✅ **Comparador manual MVP** | nada | Selección de 2-5 cards → `/compare?ids=...`, `noindex`, columnas por producto y CTA `/go`. No afirma “mismo producto”; smoke live completado. |
| **B-7** | 🟡 **Segundo merchant de iluminación** | verificación Skimlinks + feed/permiso del owner | Spike completado: GreenIce recomendado, Barcelona LED fallback. No ingestar hasta superar los gates de `docs/merchant-sourcing-lighting.md`. |

### 🟡 Después del núcleo

| # | Item | Nota |
|---|---|---|
| **B-8** | **Comparación automática cross-store** | Requiere segundo merchant y una estrategia explícita de matching/canonical SKU. |
| **B-9** | **Embeddings / similarity search** | Sólo después de medir la búsqueda estructurada corregida; estimar coste y latencia con datos reales. |
| **B-10** | ✅ **Ocultar merchants/URLs placeholder** | Sólo cuatro merchants reales son visibles por API; las cinco rutas placeholder históricas devuelven 404. Sustituir/reactivar sólo tras sourcing. |
| **B-11** | ✅ **Restringir `/api/test/*`** | Ya existe gate absoluto de producción y ambas rutas devuelven 404 en live. |
| **B-12** | **AdSense** | `/search` está bloqueado en robots; no describirlo como página indexable. Esperar tráfico y revisar CWV/UX. |
| **B-13** | Gift finder, featured stores, newsletter, marca EUIPO | Expansión una vez medidos search → PDP → click-out y retención. |

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
pnpm scripts:seed:collection
pnpm scripts:seed:products
pnpm scripts:seed:lighting
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
4. **Deploy Vercel** (auto al push). Ya renderiza `/explore/mi-nuevo-niche`, en home aparece como chip, en sidebar de /search aparece en NICHE_FACET, y `/sitemap.xml` lo incluye automáticamente tras 1h ISR.

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

- [ ] Supabase Auth: `Site URL = https://shopifind.app`; allowlist del callback; plantilla Magic Link con `{{ .ConfirmationURL }}`. Pedir un enlace nuevo después del cambio.
- [ ] Google OAuth: crear OAuth Client web, autorizar `https://tndnglgfcigsreozlqfv.supabase.co/auth/v1/callback` y habilitar Google en Supabase. No compartir el Client Secret por chat.
- [ ] Google Search Console: registrar `https://shopifind.app` → verificación DNS TXT → Sitemaps > Add → `https://shopifind.app/sitemap.xml`.
- [ ] Bing Webmaster Tools (opcional pero gratis): mismo proceso.
- [ ] Plausible analytics: verificar que el dominio `shopifind.app` está añadido y `<script>` en `layout.tsx` carga.
- [ ] Legal/privacidad: proporcionar identidad pública, NIF, domicilio/datos registrales si aplican, bases y retenciones; completar `docs/launch-compliance-checklist.md` antes de activar más tracking o adquisición.
- [ ] Confirmar el eco-score `78` para masterled con curación humana (es el único valor auto-asignado en el seed; el resto vieram del seed.sql).
- [ ] Rotar el `SKIMLINKS_DOMAIN_ID` placeholder en `.env.local` (real key ya está en Vercel env, ¿OK?).
- [ ] Segundo merchant iluminación: comprobar primero GreenIce y después Barcelona LED en el dashboard real de Skimlinks; sólo entonces solicitar/usar un feed autorizado (`docs/merchant-sourcing-lighting.md`).

---

## 13. TL;DR one-liners para una nueva persona en el proyecto

- **¿Qué es esto?** Buscador D2C de tiendas indie en 4 verticales · busca conversacional con IA · monetiza con Skimlinks affiliate.
- **¿Dónde corre?** Vercel EU Frankfurt + Supabase Cloud. Domain `shopifind.app`.
- **¿Cómo se cambia un nicho?** Editar `src/lib/config.ts → primaryNiches + NICHE_LABEL`. Vercel auto-redeploy.
- **¿Cómo se añade un producto?** Vía `pnpm scripts:seed:products` (multi-merchant) o `pnpm scripts:seed:lighting` (masterled) → usar `--dry-run` primero.
- **¿Cómo se mide?** Plausible (setup pendiente de verificar) + `click_attribution`; el receiver existe, falta conexión y prueba E2E con Skimlinks.
- **¿Cuál es el siguiente milestone live pendiente?** Owner: aplicar la migración de alertas y configurar secretos para activar refresh/email; en paralelo, corregir Supabase Auth, enviar sitemap a GSC y validar el segundo merchant en Skimlinks.

---

*Este documento es la memoria viva. Si añades un milestone que cambia la arquitectura, edita este archivo en el mismo commit. Convencional: nombre `HANDOFF.md`, sección nueva al final de "Resumen de lo realizado" antes de los gotchas.*
