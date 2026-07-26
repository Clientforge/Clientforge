import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#fdf5f8",
          100: "#fbe8ef",
          200: "#f6d0df",
          300: "#eea8c2",
          400: "#e27ba0",
          500: "#d15580",
          600: "#bc3a66",
          700: "#9e2d53",
          800: "#842848",
          900: "#70253f",
          950: "#431021",
        },
        blush: {
          50: "#fef7f8",
          100: "#fdeef1",
          200: "#fbdce3",
          300: "#f7becb",
          400: "#f094a9",
          500: "#e56d88",
        },
        mauve: {
          50: "#f9f5fa",
          100: "#f2ebf5",
          200: "#e6d8ec",
          300: "#d4b9de",
          400: "#b992c9",
          500: "#9a6fad",
        },
        cream: {
          50: "#fffcf9",
          100: "#fdf8f3",
          200: "#faf0e6",
        },
        stone: {
          50: "#faf9f8",
          100: "#f5f3f1",
          200: "#e8e4e0",
          300: "#d6d0ca",
          400: "#b8afa6",
          500: "#9a8f85",
          600: "#7d7269",
          700: "#665d56",
          800: "#524b46",
          900: "#443f3b",
        },
      },
      boxShadow: {
        soft: "0 2px 16px -2px rgba(188, 58, 102, 0.08), 0 4px 24px -4px rgba(67, 16, 33, 0.06)",
        "soft-lg": "0 8px 32px -4px rgba(188, 58, 102, 0.12), 0 16px 48px -8px rgba(67, 16, 33, 0.08)",
        glow: "0 0 24px -4px rgba(209, 85, 128, 0.25)",
      },
      backgroundImage: {
        "page-gradient": "linear-gradient(135deg, #fffcf9 0%, #fdf5f8 40%, #f9f5fa 100%)",
        "page-gradient-dark": "linear-gradient(135deg, #1c1917 0%, #251a22 45%, #1a1520 100%)",
        "sidebar-gradient": "linear-gradient(180deg, #fffcf9 0%, #fdf8f3 50%, #fbe8ef 100%)",
        "sidebar-gradient-dark": "linear-gradient(180deg, #1c1917 0%, #221820 50%, #2a1520 100%)",
        "brand-gradient": "linear-gradient(135deg, #e27ba0 0%, #d15580 50%, #bc3a66 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
