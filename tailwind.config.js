/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'trading-bg': '#0B0E11',
        'trading-card': '#1E2329',
        'trading-border': '#2B3139',
        'trading-text': '#EAECEF',
        'trading-text-secondary': '#848E9C',
        'trading-green': '#0ECB81',
        'trading-red': '#F6465D',
        'trading-yellow': '#F0B90B'
      },
      fontFamily: {
        'mono': ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
