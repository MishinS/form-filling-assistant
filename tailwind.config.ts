import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", "surface-1": "var(--surface-1)", "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)", "surface-hi": "var(--surface-hi)",
        text: "var(--text)", "text-2": "var(--text-2)", "text-3": "var(--text-3)", "text-inv": "var(--text-inv)",
        accent: "var(--accent)", "accent-text": "var(--accent-text)",
        ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)", info: "var(--info)",
      },
      borderRadius: { sm: "var(--r-sm)", md: "var(--r-md)", lg: "var(--r-lg)", xl: "var(--r-xl)", pill: "var(--pill)" },
      fontFamily: { display: "var(--font-display)", sans: "var(--font-sans)", mono: "var(--font-mono)" },
    },
  },
  plugins: [],
};
export default config;
