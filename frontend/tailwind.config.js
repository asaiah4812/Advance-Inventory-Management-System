/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6', // blue-500
        secondary: '#10b981', // emerald-500
        background: '#f3f4f6', // gray-100
        surface: '#ffffff',
        text: '#1f2937', // gray-800
      }
    },
  },
  plugins: [],
}
