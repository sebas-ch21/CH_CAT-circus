export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        charlie: {
          teal: '#007C8C',
          'teal-dark': '#006070',
          'teal-light': '#008FA0',
          mint: '#BEE7E9',
          'mint-light': '#E0F5F6',
        },
        primary: {
          50: '#E0F5F6',
          100: '#BEE7E9',
          200: '#9DD9DC',
          300: '#7BCBCF',
          400: '#5ABDC2',
          500: '#007C8C',
          600: '#006D7A',
          700: '#005E68',
          800: '#004F56',
          900: '#004044',
        },
        secondary: {
          50: '#E0F5F6',
          100: '#BEE7E9',
          200: '#9DD9DC',
          300: '#7BCBCF',
          400: '#5ABDC2',
          500: '#39AFB5',
          600: '#2E8C91',
          700: '#23696D',
          800: '#184649',
          900: '#0D2325',
        },
      },
    },
  },
  plugins: [],
}
