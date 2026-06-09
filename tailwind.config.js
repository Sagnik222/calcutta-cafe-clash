/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: '#f4ecd8',
        cream: '#fbf6e9',
        forest: '#1f4d3c',
        sepia: '#8b6f47',
        walnut: '#6b4423',
        ink: '#1a1a1a',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Georgia', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
}
