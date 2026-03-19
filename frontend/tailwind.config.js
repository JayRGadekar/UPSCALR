/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        black: '#000000',
        white: '#FFFFFF',
        gray: {
          100: '#F3F3F3',
          200: '#E8E8E8',
          300: '#D1D1D1',
          400: '#A1A1A1',
          500: '#808080',
          600: '#606060',
          700: '#404040',
          800: '#202020',
          900: '#0A0A0A'
        }
      }
    }
  },
  plugins: []
};
