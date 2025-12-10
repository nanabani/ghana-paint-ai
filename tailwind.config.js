/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1c1917',
          muted: '#44403c',
          subtle: '#78716c',
        },
        paper: {
          DEFAULT: '#faf8f5',
          warm: '#f5f1eb',
          elevated: '#ffffff',
        },
        accent: {
          DEFAULT: '#c2410c',
          hover: '#9a3412',
          soft: '#fed7aa',
        },
        secondary: {
          DEFAULT: '#b45309',
          soft: '#fef3c7',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      animation: {
        'reveal-up': 'reveal-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'reveal': 'reveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'reveal-scale': 'reveal-scale 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'shimmer': 'shimmer 1.5s infinite',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        'rainbow': 'rainbow 2s infinite linear',
      },
      keyframes: {
        'reveal-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'reveal': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'reveal-scale': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        'rainbow': {
          '0%': { backgroundPosition: '0%' },
          '100%': { backgroundPosition: '200%' },
        },
      },
    },
  },
  plugins: [],
}

