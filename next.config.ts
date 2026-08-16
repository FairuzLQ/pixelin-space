import type { NextConfig } from "next";

// Derive the exact Supabase host so we don't allow images from *any* *.supabase.co
const supabaseHost = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname }
  catch { return undefined }
})()

// Supabase origins for REST (https) + realtime (wss). Fall back to the wildcard
// only if the env var is missing at build time.
const supaHttps = supabaseHost ? `https://${supabaseHost}` : 'https://*.supabase.co'
const supaWss = supabaseHost ? `wss://${supabaseHost}` : 'wss://*.supabase.co'

// React's dev tooling needs eval(); production never does. Only relax in dev.
const isDev = process.env.NODE_ENV !== 'production'
const scriptSrc = `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`

const csp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  // inline styles are used heavily (style={{…}}); scripts need inline for Next
  // hydration. 'unsafe-eval' is added in dev only (React debugging). User
  // content is React-escaped, so this is defense-in-depth, not the primary
  // XSS control.
  scriptSrc,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${supaHttps}`,
  `font-src 'self' data:`,
  `connect-src 'self' ${supaHttps} ${supaWss}`,
  // browser-image-compression spins up a web worker from a blob URL
  `worker-src 'self' blob:`,
  `manifest-src 'self'`,
  `upgrade-insecure-requests`,
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost }]
      : [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
    ]
  },
};

export default nextConfig;
