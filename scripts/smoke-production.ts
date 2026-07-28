/**
 * Read-only release smoke test for a deployed Shopifind environment.
 *
 * Usage:
 *   pnpm smoke:production
 *   pnpm smoke:production -- https://preview.example.com
 *
 * The script deliberately needs no credentials. It discovers a live product
 * through the sitemap so it does not depend on a hard-coded catalog fixture.
 */

const DEFAULT_BASE_URL = "https://shopifind.app";
const REQUEST_TIMEOUT_MS = 20_000;
const REDIRECT_STATUSES = new Set([302, 303, 307, 308]);

type Check = {
  name: string;
  run: () => Promise<string | void>;
};

function normalizeBaseUrl(raw: string | undefined): URL {
  const url = new URL(raw ?? DEFAULT_BASE_URL);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("La base URL debe usar http o https.");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function siteUrl(baseUrl: URL, path: string): URL {
  return new URL(path, baseUrl);
}

async function request(url: URL, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    cache: "no-store",
    redirect: init.redirect ?? "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "user-agent": "shopifind-release-smoke/1.0",
      ...init.headers,
    },
  });
}

function expectStatus(response: Response, expected: number): void {
  if (response.status !== expected) {
    throw new Error(`esperado HTTP ${expected}; recibido ${response.status}`);
  }
}

function expectText(haystack: string, needle: string, label: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`falta ${label}`);
  }
}

function productPaths(html: string): Set<string> {
  return new Set(html.match(/\/product\/[a-z0-9-]+/g) ?? []);
}

function productUrlFromSitemap(
  sitemap: string,
  baseUrl: URL,
  slugPrefix = "",
): URL {
  const locations = [
    ...sitemap.matchAll(/<loc>([^<]+\/product\/[a-z0-9-]+)<\/loc>/g),
  ];
  const location = locations
    .map((match) => match[1])
    .find((value) => {
      if (!value) return false;
      return new URL(value).pathname.startsWith(`/product/${slugPrefix}`);
    });
  if (!location) {
    throw new Error(
      slugPrefix
        ? `el sitemap no contiene una PDP con prefijo ${slugPrefix}`
        : "el sitemap no contiene ninguna PDP",
    );
  }

  const productUrl = new URL(location);
  if (productUrl.origin !== baseUrl.origin) {
    throw new Error("una PDP del sitemap apunta fuera del sitio");
  }
  return productUrl;
}

function firstOptimizedImageUrl(html: string, baseUrl: URL): URL {
  const match = html.match(/\/_next\/image\?url=[^"' ]+/);
  if (!match?.[0]) throw new Error("la PDP no contiene una imagen optimizada");
  return new URL(match[0].replaceAll("&amp;", "&"), baseUrl);
}

async function expectLoginRedirect(
  baseUrl: URL,
  path: "/wishlist" | "/account",
): Promise<string> {
  const response = await request(siteUrl(baseUrl, path));
  if (!REDIRECT_STATUSES.has(response.status)) {
    throw new Error(
      `esperado redirect de auth; recibido HTTP ${response.status}`,
    );
  }

  const location = response.headers.get("location");
  if (!location) throw new Error("redirect sin cabecera Location");
  const target = new URL(location, baseUrl);
  if (
    target.origin !== baseUrl.origin ||
    target.pathname !== "/login" ||
    target.searchParams.get("next") !== path
  ) {
    throw new Error(`destino de auth inesperado: ${target.toString()}`);
  }
  return `${response.status} → ${target.pathname}?next=${path}`;
}

async function main(): Promise<void> {
  const baseUrl = normalizeBaseUrl(process.argv[2]);
  let sitemapXml = "";
  let productUrl: URL | null = null;
  let productHtml = "";
  let failures = 0;

  const checks: Check[] = [
    {
      name: "home",
      run: async () => {
        const response = await request(baseUrl);
        expectStatus(response, 200);
        expectText(await response.text(), "Shopifind", "marca en HTML");
        return "HTTP 200";
      },
    },
    {
      name: "cabeceras de seguridad",
      run: async () => {
        const response = await request(baseUrl);
        expectStatus(response, 200);
        const csp = response.headers.get("content-security-policy") ?? "";
        for (const directive of [
          "default-src 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
          "upgrade-insecure-requests",
        ]) {
          expectText(csp, directive, `directiva CSP ${directive}`);
        }
        expectText(
          response.headers.get("permissions-policy") ?? "",
          "camera=()",
          "Permissions-Policy",
        );
        if (response.headers.has("x-powered-by")) {
          throw new Error("X-Powered-By sigue publicado");
        }
        if (response.headers.get("x-frame-options") !== "DENY") {
          throw new Error("X-Frame-Options no es DENY");
        }
        return "CSP + permisos + anti-frame";
      },
    },
    {
      name: "search sin texto",
      run: async () => {
        const response = await request(siteUrl(baseUrl, "/search?sort=newest"));
        expectStatus(response, 200);
        expectText(
          await response.text(),
          "Catálogo",
          "encabezado del catálogo",
        );
        return "HTTP 200";
      },
    },
    {
      name: "paginación real",
      run: async () => {
        const [first, second] = await Promise.all([
          request(siteUrl(baseUrl, "/explore/iluminacion?page=1&page_size=24")),
          request(siteUrl(baseUrl, "/explore/iluminacion?page=2&page_size=24")),
        ]);
        expectStatus(first, 200);
        expectStatus(second, 200);
        const [firstHtml, secondHtml] = await Promise.all([
          first.text(),
          second.text(),
        ]);
        const firstProducts = productPaths(firstHtml);
        const secondProducts = productPaths(secondHtml);
        if (firstProducts.size === 0 || secondProducts.size === 0) {
          throw new Error("una página no contiene productos");
        }
        const overlap = [...firstProducts].filter((path) =>
          secondProducts.has(path),
        );
        if (overlap.length > 0) {
          throw new Error(`productos repetidos entre páginas: ${overlap[0]}`);
        }
        return `${firstProducts.size} + ${secondProducts.size} productos distintos`;
      },
    },
    {
      name: "login",
      run: async () => {
        const response = await request(siteUrl(baseUrl, "/login"));
        expectStatus(response, 200);
        return "HTTP 200";
      },
    },
    {
      name: "wishlist protegida",
      run: () => expectLoginRedirect(baseUrl, "/wishlist"),
    },
    {
      name: "account protegida",
      run: () => expectLoginRedirect(baseUrl, "/account"),
    },
    {
      name: "robots",
      run: async () => {
        const response = await request(siteUrl(baseUrl, "/robots.txt"));
        expectStatus(response, 200);
        const body = await response.text();
        for (const path of ["/go/", "/search", "/api/"]) {
          expectText(body, `Disallow: ${path}`, `bloqueo robots de ${path}`);
        }
        return "rutas sensibles bloqueadas";
      },
    },
    {
      name: "sitemap",
      run: async () => {
        const response = await request(siteUrl(baseUrl, "/sitemap.xml"));
        expectStatus(response, 200);
        sitemapXml = await response.text();
        expectText(sitemapXml, "<urlset", "urlset");
        productUrl = productUrlFromSitemap(sitemapXml, baseUrl);
        return `PDP descubierta: ${productUrl.pathname}`;
      },
    },
    {
      name: "PDP + SEO",
      run: async () => {
        if (!productUrl) throw new Error("dependencia sitemap no disponible");
        const response = await request(productUrl);
        expectStatus(response, 200);
        productHtml = await response.text();
        expectText(
          productHtml,
          `<link rel="canonical" href="${productUrl.toString()}"`,
          "canonical",
        );
        expectText(productHtml, '"@type":"Product"', "Product JSON-LD");
        expectText(
          productHtml,
          'aria-label="Compartir producto"',
          "control de compartir",
        );
        return "canonical + Product JSON-LD + share";
      },
    },
    {
      name: "optimizador de imágenes",
      run: async () => {
        if (!productHtml) throw new Error("dependencia PDP no disponible");
        if (!sitemapXml) throw new Error("dependencia sitemap no disponible");
        const masterledUrl = productUrlFromSitemap(
          sitemapXml,
          baseUrl,
          "masterled-",
        );
        const masterledPage = await request(masterledUrl);
        expectStatus(masterledPage, 200);
        const masterledHtml = await masterledPage.text();
        const imageUrls = [
          firstOptimizedImageUrl(productHtml, baseUrl),
          firstOptimizedImageUrl(masterledHtml, baseUrl),
        ];
        const [firstImage, masterledImage, blockedHost] = await Promise.all([
          request(imageUrls[0]!),
          request(imageUrls[1]!),
          request(
            siteUrl(
              baseUrl,
              "/_next/image?url=https%3A%2F%2Fexample.com%2Fblocked.jpg&w=640&q=75",
            ),
          ),
        ]);
        const allowedImages = [firstImage, masterledImage];
        for (const response of allowedImages) {
          expectStatus(response, 200);
          const contentType = response.headers.get("content-type") ?? "";
          if (!contentType.startsWith("image/")) {
            throw new Error(
              `content-type inesperado: ${contentType || "vacío"}`,
            );
          }
        }
        expectStatus(blockedHost, 400);
        return `${allowedImages
          .map((response) => response.headers.get("content-type"))
          .join(" + ")}; host ajeno bloqueado`;
      },
    },
    {
      name: "redirect Skimlinks",
      run: async () => {
        if (!productUrl) throw new Error("dependencia sitemap no disponible");
        const goPath = productUrl.pathname.replace("/product/", "/go/");
        const response = await request(siteUrl(baseUrl, goPath));
        if (!REDIRECT_STATUSES.has(response.status)) {
          throw new Error(
            `esperado redirect; recibido HTTP ${response.status}`,
          );
        }
        const location = response.headers.get("location");
        if (!location) throw new Error("redirect sin cabecera Location");
        const target = new URL(location);
        if (
          target.hostname !== "go.redirectingat.com" ||
          !target.searchParams.get("xcust")?.startsWith("shopifind-")
        ) {
          throw new Error("destino o atribución Skimlinks incorrectos");
        }
        return `${response.status} → ${target.hostname}`;
      },
    },
    {
      name: "cron alertas cerrado",
      run: async () => {
        const response = await request(
          siteUrl(baseUrl, "/api/cron/process-price-alerts"),
        );
        expectStatus(response, 401);
        return "HTTP 401";
      },
    },
    {
      name: "cron catálogo cerrado",
      run: async () => {
        const response = await request(
          siteUrl(baseUrl, "/api/cron/refresh-masterled"),
        );
        expectStatus(response, 401);
        return "HTTP 401";
      },
    },
    {
      name: "APIs de test ocultas",
      run: async () => {
        const [signin, whoami] = await Promise.all([
          request(siteUrl(baseUrl, "/api/test/signin"), { method: "POST" }),
          request(siteUrl(baseUrl, "/api/test/whoami")),
        ]);
        expectStatus(signin, 404);
        expectStatus(whoami, 404);
        return "HTTP 404 + 404";
      },
    },
  ];

  console.log(`Smoke de release: ${baseUrl.origin}`);
  for (const check of checks) {
    try {
      const detail = await check.run();
      console.log(`✓ ${check.name}${detail ? ` — ${detail}` : ""}`);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${check.name} — ${message}`);
    }
  }

  if (failures > 0) {
    throw new Error(`${failures} comprobación(es) fallaron`);
  }
  console.log(`Smoke completo: ${checks.length}/${checks.length}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Smoke fallido: ${message}`);
  process.exitCode = 1;
});
