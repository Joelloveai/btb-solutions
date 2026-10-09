import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx,mjs}",
  ],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        // Money and other figures: fixed-width digits line up down a column.
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // shadcn/ui tokens (values live in globals.css)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },

        // Primary: deep charcoal navy. Accent: muted amber (links, active marker, key actions).
        brand: { DEFAULT: "#0f172a", dark: "#020617", light: "#e2e8f0" },
        accent: { DEFAULT: "#b45309", strong: "#92400e", light: "#fef3c7" },

        // Semantic colours: used ONLY for data states.
        profit: { DEFAULT: "#15803d", light: "#f0fdf4", dark: "#166534" },
        loss: { DEFAULT: "#b91c1c", light: "#fef2f2", dark: "#991b1b" },
        pending: { DEFAULT: "#b45309", light: "#fffbeb", dark: "#92400e" },

        // Tremor theme (KPI cards)
        tremor: {
          brand: { faint: "#f8fafc", muted: "#e2e8f0", subtle: "#64748b", DEFAULT: "#0f172a", emphasis: "#020617", inverted: "#ffffff" },
          background: { muted: "#f8fafc", subtle: "#f1f5f9", DEFAULT: "#ffffff", emphasis: "#334155" },
          border: { DEFAULT: "#e2e8f0" },
          ring: { DEFAULT: "#e2e8f0" },
          content: { subtle: "#94a3b8", DEFAULT: "#64748b", emphasis: "#0f172a", strong: "#020617", inverted: "#ffffff" },
        },
      },
      boxShadow: {
        "tremor-card": "0 1px 2px 0 rgb(15 23 42 / 0.05)",
        "tremor-input": "0 1px 2px 0 rgb(15 23 42 / 0.05)",
        "tremor-dropdown": "0 4px 6px -1px rgb(15 23 42 / 0.1)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
      },
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
      },
    },
  },
  plugins: [animate],
};
export default config;
