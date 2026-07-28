/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B1120",
          900: "#111828",
          800: "#1A2338",
          700: "#242F4A",
          600: "#38445F",
        },
        mist: {
          400: "#8B96AC",
          200: "#C7CFDE",
          100: "#E8ECF4",
        },
        voice: {
          DEFAULT: "#4FE8C7",
          dim: "#2E9C87",
          glow: "#7FFCE0",
        },
        signal: {
          DEFAULT: "#7C8CFF",
          dim: "#5A63C4",
        },
        listen: {
          DEFAULT: "#FF6B6B",
          dim: "#C74F4F",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
      keyframes: {
        "orb-breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.06)" },
        },
        "ring-pulse": {
          "0%": { transform: "scale(0.9)", opacity: "0.6" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        "wave-bar": {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        "orb-breathe": "orb-breathe 3.2s ease-in-out infinite",
        "ring-pulse-1": "ring-pulse 2.4s ease-out infinite",
        "ring-pulse-2": "ring-pulse 2.4s ease-out infinite 0.8s",
        "ring-pulse-3": "ring-pulse 2.4s ease-out infinite 1.6s",
        "wave-bar": "wave-bar 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};