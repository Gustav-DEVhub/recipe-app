/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'var(--bg-app)'
        },
        card: {
          DEFAULT: 'var(--panel-bg)'
        },
        border: {
          DEFAULT: 'var(--panel-border)'
        }
      }
    }
  },
  plugins: []
};
