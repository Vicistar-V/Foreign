import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      keyframes: {
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" }
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "50%": { transform: "scale(1.05)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        "check-draw": {
          "0%": { strokeDashoffset: "100" },
          "100%": { strokeDashoffset: "0" }
        },
        "badge-shine": {
          "0%": { left: "-100%" },
          "100%": { left: "200%" }
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" }
        },
        "button-press": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.96)" }
        },
        "ripple": {
          "0%": { transform: "scale(0)", opacity: "1" },
          "100%": { transform: "scale(4)", opacity: "0" }
        },
        "sparkle": {
          "0%, 100%": { opacity: "0", transform: "scale(0)" },
          "50%": { opacity: "1", transform: "scale(1)" }
        },
        "dot-bounce": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.2)" }
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(var(--primary) / 0.3)" },
          "50%": { boxShadow: "0 0 30px hsl(var(--primary) / 0.5)" }
        },
        // Beast Mode Animations
        "liquid-fill": {
          "0%": { transform: "translateY(100%)", opacity: "0.5" },
          "100%": { transform: "translateY(0%)", opacity: "1" }
        },
        "golden-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(var(--cyber-gold) / 0.3)" },
          "50%": { boxShadow: "0 0 40px hsl(var(--cyber-gold) / 0.5)" }
        },
        "tube-overflow": {
          "0%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" }
        },
        "tier-glow": {
          "0%, 100%": { boxShadow: "0 0 15px hsl(var(--cyber-gold) / 0.3)" },
          "50%": { boxShadow: "0 0 30px hsl(var(--cyber-gold) / 0.5)" }
        },
        "card-flip": {
          "0%": { transform: "perspective(1000px) rotateY(-90deg)", opacity: "0" },
          "100%": { transform: "perspective(1000px) rotateY(0deg)", opacity: "1" }
        },
        "heartbeat": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.6" },
          "50%": { transform: "scale(1.05)", opacity: "1" }
        },
        "lightning": {
          "0%": { opacity: "0", transform: "translateX(-100%)" },
          "10%": { opacity: "1" },
          "30%": { opacity: "0.8", transform: "translateX(100%)" },
          "100%": { opacity: "0", transform: "translateX(100%)" }
        },
        "number-pop": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.2)" }
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "wave": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "shimmer": "shimmer 2s ease-in-out infinite",
        "slide-up": "slide-up 0.4s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "pop-in": "pop-in 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "check-draw": "check-draw 0.5s ease-out",
        "badge-shine": "badge-shine 3s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "button-press": "button-press 0.2s ease-out",
        "ripple": "ripple 0.6s ease-out",
        "sparkle": "sparkle 1s ease-in-out",
        "dot-bounce": "dot-bounce 0.6s ease-in-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        // Beast Mode Animations
        "liquid-fill": "liquid-fill 0.8s ease-out",
        "golden-pulse": "golden-pulse 2s ease-in-out infinite",
        "tube-overflow": "tube-overflow 0.6s ease-out",
        "tier-glow": "tier-glow 2s ease-in-out infinite",
        "card-flip": "card-flip 0.6s ease-out",
        "heartbeat": "heartbeat 1.5s ease-in-out infinite",
        "lightning": "lightning 3s ease-in-out infinite",
        "number-pop": "number-pop 0.3s ease-out",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "wave": "wave 8s linear infinite",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        "accent-orange": {
          DEFAULT: "hsl(var(--accent-orange))",
          foreground: "hsl(var(--accent-orange-foreground))",
        },
        caution: {
          DEFAULT: "hsl(var(--caution))",
          foreground: "hsl(var(--caution-foreground))",
          muted: "hsl(var(--caution-muted))",
          "muted-foreground": "hsl(var(--caution-muted-foreground))",
        },
        highlight: {
          DEFAULT: "hsl(var(--highlight))",
          foreground: "hsl(var(--highlight-foreground))",
        },
        community: {
          DEFAULT: "hsl(var(--community))",
          foreground: "hsl(var(--community-foreground))",
        },
        social: {
          whatsapp: "hsl(var(--social-whatsapp))",
          twitter: "hsl(var(--social-twitter))",
          facebook: "hsl(var(--social-facebook))",
        },
        // Beast Mode Cyber Colors
        cyber: {
          gold: "hsl(var(--cyber-gold))",
          "gold-glow": "hsl(var(--cyber-gold-glow))",
          cyan: "hsl(var(--cyber-cyan))",
          "cyan-glow": "hsl(var(--cyber-cyan-glow))",
          bronze: "hsl(var(--cyber-bronze))",
          silver: "hsl(var(--cyber-silver))",
          platinum: "hsl(var(--cyber-platinum))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
