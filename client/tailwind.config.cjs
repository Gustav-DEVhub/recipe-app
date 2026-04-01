/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0b1220'
        },
        card: {
          DEFAULT: 'rgba(255,255,255,0.06)'
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.12)'
        }
      }
    }
  },
  plugins: []
};

