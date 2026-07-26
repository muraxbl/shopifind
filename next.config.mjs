/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      // Skimlinks / merchants comunes — wildcard '**' acepta cualquier dominio HTTPS
      { protocol: 'https', hostname: '**' },
    ],
    // placehold.co y otros placeholders devuelven SVG; next/image los rechaza por defecto.
    // dangerouslyAllowSVG los deja pasar + CSP sándbox evita ejecución de scripts embebidos.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    formats: ['image/avif', 'image/webp'],
  },
  // Redirección /go/[id] -> affiliate (server-side 302)
  // Configurada en /src/app/go/[id]/route.ts (route handler)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
