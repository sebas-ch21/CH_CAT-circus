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
          purple: '#A890D3',
          'purple-dark': '#8B6FC4',
          'purple-light': '#C5B4E3',
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
          50: '#F3EFF9',
          100: '#E7DFF3',
          200: '#D4C3E7',
          300: '#C5B4E3',
          400: '#A890D3',
          500: '#8B6FC4',
          600: '#7558AD',
          700: '#5E4791',
          800: '#4A3770',
          900: '#362750',
        },
      },
    },
  },
  plugins: [],
}
