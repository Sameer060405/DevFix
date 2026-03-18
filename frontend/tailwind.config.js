/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },

      /* ── Map gray → exact Tailwind slate values ───────────────────
         Every existing bg-gray-* / text-gray-* class in the codebase
         now renders the proper slate-dark theme automatically.        */
      colors: {
        gray: {
          950: "#020617",   // slate-950  — deepest background
          900: "#0f172a",   // slate-900  — card surfaces
          800: "#1e293b",   // slate-800  — raised elements
          700: "#334155",   // slate-700  — borders
          600: "#475569",   // slate-600  — muted borders
          500: "#64748b",   // slate-500  — placeholder text
          400: "#94a3b8",   // slate-400  — secondary text
          300: "#cbd5e1",   // slate-300  — body text
          200: "#e2e8f0",   // slate-200  — heading secondary
          100: "#f1f5f9",   // slate-100  — primary text
        },
      },

      /* ── Custom box-shadow tokens ──────────────────────────────── */
      boxShadow: {
        "glow-violet":  "0 0 24px rgba(139,92,246,0.35), 0 0 80px rgba(139,92,246,0.1)",
        "glow-indigo":  "0 0 24px rgba(99,102,241,0.4),  0 0 80px rgba(99,102,241,0.12)",
        "glow-sm":      "0 0 12px rgba(139,92,246,0.4)",
        "glow-xs":      "0 0 8px  rgba(139,92,246,0.3)",
        "card":         "0 4px 32px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04) inset",
        "card-hover":   "0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.2)",
        "dropdown":     "0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)",
      },

      /* ── Keyframes ─────────────────────────────────────────────── */
      keyframes: {
        blob: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "33%":     { transform: "translate(30px,-50px) scale(1.12)" },
          "66%":     { transform: "translate(-20px,20px) scale(0.88)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.94)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition:  "200% 0" },
        },
        "pulse-dot": {
          "0%,100%": { transform: "scale(1)",   opacity: "1"   },
          "50%":     { transform: "scale(1.4)", opacity: "0.6" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to:   { opacity: "1", transform: "translateX(0)"    },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-24px)" },
          to:   { opacity: "1", transform: "translateX(0)"     },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)"  },
          "50%":     { transform: "translateY(-12px)" },
        },
        "cursor-blink": {
          "0%,49%":  { opacity: "1" },
          "50%,100%":{ opacity: "0" },
        },
      },

      /* ── Animation utilities ───────────────────────────────────── */
      animation: {
        blob:             "blob 7s ease-in-out infinite",
        "fade-up":        "fade-up 0.4s ease both",
        "fade-in":        "fade-in 0.35s ease both",
        "scale-in":       "scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
        shimmer:          "shimmer 1.6s linear infinite",
        "pulse-dot":      "pulse-dot 2s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.4s ease both",
        "slide-in-left":  "slide-in-left 0.4s ease both",
        float:            "float 4s ease-in-out infinite",
        "cursor-blink":   "cursor-blink 1s step-end infinite",
      },
    },
  },
  plugins: [],
};
