/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        body: ['Inter', 'sans-serif'],
        headline: ['Syne', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg: '#0a0a0a',
        surface: '#111111',
        'surface-raised': '#1a1a1a',
        border: '#222222',
        'accent-red': '#e63946',
        'accent-blue': '#00d4ff',
        'text-primary': '#f0f0f0',
        'text-muted': '#888888',
      },
    },
  },
  plugins: [],
}
