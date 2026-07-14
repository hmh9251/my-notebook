import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="linearDark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        // Status colors
        status: {
          dev: "hsl(var(--status-dev) / <alpha-value>)",
          testing: "hsl(var(--status-testing) / <alpha-value>)",
          released: "hsl(var(--status-released) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Inter", '"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ["Consolas", '"Courier New"', "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", "1rem"],
      },
      transitionDuration: {
        "80": "80ms",
      },
    },
  },
  plugins: [],
};

export default config;
