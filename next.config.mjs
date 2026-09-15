/** @type {import('next').NextConfig} */
const nextConfig = {
  // The /api/fill route reads its template files at runtime via dynamically-built
  // paths, which Next's output file tracing can't detect on its own. Without this,
  // the template is absent in the Vercel serverless function and every fill 500s.
  // (Next 14.2: key lives under `experimental`.)
  experimental: {
    outputFileTracingIncludes: {
      "/api/fill": ["./lib/fill/templates/pt.xlsx", "./lib/render/templates/ed.html"],
    },
  },
};

export default nextConfig;
