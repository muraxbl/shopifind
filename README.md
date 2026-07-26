# Shopifind — Buscador B2C de tiendas independientes multi-nicho

> **Tagline:** *Less Amazon, more you.* Encuentra tiendas independientes reales en moda sostenible, gadgets indie y deco/hogar con un solo buscador. Powered by AI, con wishlist universal y alertas inteligentes.

---

## 🎯 El producto en una frase

**Shopifind** es un *personal shopper digital* B2C que indexa tiendas independientes de **3-5 nichos curados**, permite búsqueda conversacional con IA, wishlist universal cross-store, y servicios de valor añadido (aesthetic matcher, gift finder, eco-score, alertas de precio/restock).

---

## 🧱 El modelo de negocio

### Monetización core (MVP → 6 meses)
| Fuente | Cuándo entra | Ingreso esperado |
|---|---|---|
| **Affiliate** (Skimlinks + ShareASale + Awin) | Día 1 | €0,02-0,03 / visita (conversión 15% CTR → 2% → 10% comisión) |
| **Freemium usuario** (Plus €3,99 / Pro €9,99) | Mes 2 | 2-3% conversión en plan pago |
| **Newsletter sponsored** (los "10 hallazgos de la semana") | Mes 3 | €200-800 por sponsor |

### Monetización escalable (6-12 meses)
- **Featured stores** €149-499/mes — tiendas destacadas en su nicho
- **Sponsored collections** €800-2.500 — colecciones curadas sponsored
- **D2C Insights B2B** — informes anonimizados de tendencias de búsqueda
- **Cashback compartido** — 50% de la comisión al usuario final (modelo Rakuten)
- **White-label API** — licenciamos el motor de discovery a portales verticales

### Unit economics objetivo
- 10k visitas/mes → ~€210 affiliate + €800 freemium
- 50k visitas/mes → ~€1.050 affiliate + €4.000 freemium + €500 newsletter
- 100k visitas/mes → ~€2.100 affiliate + €8.000 freemium + featured stores

---

## 🧭 Los 3 nichos del MVP (ajustables)

**Default actual** (puedes cambiarlos en `src/lib/config.ts`):

1. 👗 **Moda sostenible** — marcas D2C, fabricados en EU, materiales orgánicos/reciclados, vegan, B-corp.
2. 🎛️ **Gadgets indie / productivity** — pequeños fabricantes de accesorios tech, gear de WFH, organizadores, audio.
3. 🏠 **Deco & hogar** — marcas de decoración artesanal, muebles de pequeñas marcas europeas, textiles sostenibles.

**Criterios para incluir una tienda:**
- Tamaño D2C / independiente (no marketplaces que ya tengan).
- Programa de afiliado funcional (o acceso vía Skimlinks).
- Cataloga bien (RSS feed, schema.org product, o API).
- Valores / posicionamiento diferenciado (sostenible, local, indie, ético).

---

## 🛠️ Stack técnico

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | **Next.js 14** (App Router) + TypeScript | SSR para SEO, server actions, Vercel-ready |
| DB + Auth | **Supabase** (Postgres + RLS + Auth) | Auth + DB gratis hasta 500MB; RLS para seguridad por usuario |
| UI | **Tailwind CSS** + **shadcn/ui** + **Lucide** | Diseño rápido, accesible, customizable |
| Affiliate | **Skimlinks** | Conecta >60k programas; nos olvidamos del plumbing |
| Email | **Resend** + React Email | Templates en TSX, gratis hasta 3k/mes |
| AI | **OpenAI** (`gpt-4o-mini` + `text-embedding-3-small`) | Structured Outputs para query → filtros |
| Hosting | **Vercel** | Gratis hasta hobby, edge deployment |
| Analytics | **Plausible** | Privacy-friendly, sin cookies, B2C-friendly |
| Cron / ingest | **Vercel Cron** + Supabase Edge Functions | Refresh feeds diario |

---

## 🏗️ Estructura

```
shopifind/
├── src/
│   ├── app/
│   │   ├── (auth)/            # login, callback
│   │   ├── (marketing)/       # about, legal, privacy (SEO/disclaimer)
│   │   ├── (shop)/            # explore, store, product, search, wishlist, collections
│   │   └── api/               # ingest, webhooks, cron
│   ├── components/
│   │   ├── ui/                # shadcn primitives
│   │   ├── layout/            # Header, Footer
│   │   ├── product/           # ProductCard, ProductGrid
│   │   ├── search/            # AiSearchBox
│   │   └── store/             # StoreBadge, StoreProfile
│   ├── lib/
│   │   ├── supabase/          # server + client
│   │   ├── affiliate/         # Skimlinks helpers + /go/ redirect
│   │   ├── ai/                # OpenAI Structured Outputs para query intent
│   │   └── email/             # Resend templates
│   ├── actions/               # Server Actions (wishlist, auth, search)
│   └── types/                 # database.types.ts + domain types
├── supabase/
│   └── schema.sql             # Tablas + RLS + índices
├── middleware.ts              # Refresca sesión Supabase, protege /wishlist
└── README.md                  # este archivo
```

---

## 📊 Schema DB (resumen)

- **`users`** — perfil + plan + niche_prefs, FK a `auth.users`
- **`stores`** — `slug, name, url, niche, logo_url, eco_score, affiliate_program, active`
- **`niches`** — 3-5 verticales del MVP
- **`products`** — `store_id, slug, title, description, price_cents, image_url, source_url, affiliate_url, category_id, eco_tags[], attributes jsonb, in_stock, kudos_count`
- **`categories`** — jerárquica por nicho
- **`wishlists`** — `user_id` + JSONB items (pronto migrado a tabla relacional)
- **`search_history`** — para AI context y funnels
- **`editorial_collections`** — curaciones SEO tipo "Top 10 mochilas indie"

Ver [`supabase/schema.sql`](./supabase/schema.sql) para la SQL completa.

---

## ⚖️ Legal & naming

**Disclaimer obligatorio** en footer y en cada página que tenga CTA de afiliado:

> *Shopifind is an independent product discovery platform. We are not affiliated with, endorsed by, or sponsored by Shopify Inc. The names "Shopify" and "Shopify Inc." are trademarks of their respective owners and are used here only to describe catalogued merchants that happen to operate on that platform.*

**Estrategia defensiva:**
- Dominio principal: `shopifind.com`
- Plan B (registrar HOY): `nicheradar.com` o `cartcompass.com` (~12€/año)
- Trademark propia a registrar: EUIPO clase 35/42, USPTO clase 35 (~300-800€)

---

## 🚀 Plan 90 días

| Semanas | Hito |
|---|---|
| 1-2 | **Foundation**: proyecto Next.js, DB schema, auth, home estática con hero. Registrar Skimlinks + Resend + OpenAI. |
| 3-4 | **Ingesta**: 100-150 tiendas en 3 nichos vía Skimlinks. Normalización con LLM (categorías, eco_tags). |
| 5-6 | **MVP público**: explore, store, product, search básico, wishlist MVP. ~100 usuarios beta. |
| 7-8 | **Retención**: alertas email (precio + restock), primera colección editorial curada. |
| 9-10 | **AI**: búsqueda conversacional con Structured Outputs (query → filtros SQL). |
| 11-12 | **Launch**: campaña orgánica TikTok/Pinterest, newsletter semanal, meta 1.000 usuarios beta. |

---

## 🧪 Setup local

### Requisitos
- Node.js 20+
- pnpm o npm
- Cuenta Supabase (free tier OK)
- API keys: Skimlinks, Resend, OpenAI, Plausible

### Comandos

```bash
# 1. Instalar dependencias
pnpm install  # o npm install

# 2. Variables de entorno
cp .env.example .env.local
# Rellena los valores en .env.local

# 3. Provisionar DB
# Ve a tu dashboard de Supabase, ejecuta supabase/schema.sql en SQL Editor.
# Copia la URL + anon key + service_role key a .env.local.

# 4. Generar tipos DB (después de schema.sql)
pnpm dlx supabase gen types typescript --project-id <ref> > src/types/database.types.ts

# 5. Dev server
pnpm dev
```

### Variables de entorno

Ver [`.env.example`](./.env.example). Críticas:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, para cron)
- `SKIMLINKS_API_KEY`, `SKIMLINKS_DOMAIN_ID`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`

---

## 📈 Métricas clave (semanal)

- **[Activation]** Wishlists creadas con ≥1 item / signups
- **[Engagement]** CTR a tienda desde shopifind
- **[Revenue]** Affiliate commissions + MRR freemium
- **[Editorial]** Tráfico SEO a `/collections/`
- **[Quality]** % productos `in_stock=true` vs total (objetivo > 85%)

---

## 🤝 Contribuir / próximos pasos

Tareas inmediatas:
1. Registrar dominio `shopifind.com` + Plan B defensivo
2. Crear cuentas: Skimlinks Publisher, Resend, OpenAI, Plausible, Supabase
3. Aplicar al programa de Shopify Affiliates (para tiendas Shopify-only)
4. Primer set de 50 tiendas candidatas MVP
5. Wireframes y branding (logo, paleta, tipo)

---

## 📝 Nota legal adicional

Status: **MVP pre-launch**. No somos asesores legales; antes de lanzar públicamente:
- Contratar abogado especializado en trademark (~500€ revisión inicial).
- Revisar y aprobar el disclaimer con abogado.
- Redactar TOS y Privacy Policy específicas (GDPR-ready).
- Asegurar cumplimiento FTC disclosure si operas en US.

---

*Less Amazon, more you.* 🛍️
