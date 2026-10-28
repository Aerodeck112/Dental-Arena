import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** Content-Security-Policy, docs/architecture.md §8.3. */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://www.google.com https://maps.google.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  /** cPanel (Setup Node.js App): a self-contained server in .next/standalone, see docs/cpanel.md. */
  output: "standalone",
  /** AVIF first: the clinic photos (the moss wall above all) come out far lighter than in WebP. */
  images: { formats: ["image/avif", "image/webp"] },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/medici", destination: "/echipa", permanent: true },
      { source: "/medici/:slug", destination: "/echipa/:slug", permanent: true },
      { source: "/confidentialitate", destination: "/politica-de-confidentialitate", permanent: true },
      { source: "/gdpr", destination: "/politica-de-confidentialitate", permanent: true },
      { source: "/privacy-policy", destination: "/politica-de-confidentialitate", permanent: true },
      { source: "/cookie-uri", destination: "/politica-cookies", permanent: true },
      { source: "/cookies", destination: "/politica-cookies", permanent: true },
      { source: "/termeni-conditii", destination: "/termeni-si-conditii", permanent: true },
      { source: "/cabinet", destination: "/crm", permanent: true },
      { source: "/cabinet/:path*", destination: "/crm", permanent: true },
      { source: "/programari", destination: "/programare", permanent: true },
    ];
  },
};

export default nextConfig;
