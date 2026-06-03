/** @type {import('next').NextConfig} */
const nextConfig = {
  // The /api/fill route reads lib/fill/templates/pt.xlsx at runtime via a
  // dynamically-built path, which Next's output file tracing can't detect on its
  // own. Without this, the template is absent in the Vercel serverless function
  // and every download 500s. (Next 14.2: key lives under `experimental`.)
  experimental: {
    outputFileTracingIncludes: {
      "/api/fill": ["./lib/fill/templates/pt.xlsx"],
    },
  },
};

export default nextConfig;
