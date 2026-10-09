import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] },
      colors: {
        // Primary: deep navy. Accent: muted amber.
        brand: { DEFAULT: "#0f172a", dark: "#020617", light: "#e2e8f0" },
        accent: { DEFAULT: "#d97706", light: "#fef3c7" },
        // Semantic colours, used only for data.
        profit: { DEFAULT: "#16a34a", light: "#f0fdf4", dark: "#15803d" },
        loss: { DEFAULT: "#dc2626", light: "#fef2f2", dark: "#b91c1c" },
        pending: { DEFAULT: "#d97706", light: "#fffbeb", dark: "#b45309" },
      },
    },
  },
  plugins: [],
};
export default config;
