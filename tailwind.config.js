/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        lytOrange: '#ff9500',
        lytPink: '#ff69b4',
        lytGrey: 'rgba(255, 255, 255, 0.5)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};