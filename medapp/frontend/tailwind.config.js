/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        med: {
          violet: "#5E60CE",
          "violet-dark": "#4749A8",
          teal: "#4EA8DE",
          rose: "#F72585",
          mint: "#80ED99",
          amber: "#FFD166",
          bg: "#F8F9FA",
          ink: "#2B2D42",
          "ink-muted": "#6B7094",
          "ink-subtle": "#B0B5CC",
          border: "#E8EAF0",
          input: "#FAFBFC",
        },
      },
      fontFamily: {
        body: ["DM Sans", "sans-serif"],
        display: ["Syne", "sans-serif"],
      },
      boxShadow: {
        "auth-card": "0 24px 64px rgba(94,96,206,0.12), 0 4px 16px rgba(0,0,0,0.06)",
        "auth-btn": "0 8px 24px rgba(94,96,206,0.38)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      animation: {
        "fade-up": "fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "slide-left": "slideLeft 0.72s cubic-bezier(0.22,1,0.36,1) both",
        "slide-right": "slideRight 0.72s cubic-bezier(0.22,1,0.36,1) both",
        "float-soft": "floatSoft 9s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideLeft: {
          "0%": { opacity: "0", transform: "translateX(-18px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(18px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        floatSoft: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-16px) rotate(5deg)" },
        },
      },
    },
  },
  plugins: [],
};
