import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta do Encontrão EJD 25 Anos - Trilhos e Destinos (extraída das logos oficiais)
        // Marrom da locomotiva (#48240C) e cobre da versão monocromática (#9C6048)
        'ferro': {
          50: '#faf5ef',
          100: '#f3e7d8',
          200: '#e6cdb0',
          300: '#d2aa83',
          400: '#b9845f',
          500: '#9c6048',
          600: '#7f4630',
          700: '#63341f',
          800: '#48240c',
          900: '#331908',
          950: '#211004',
        },
        // Vermelho do letreiro "Trilhos e Destinos" (#A83024)
        'vagao': {
          50: '#fdf3f1',
          100: '#fbe3df',
          200: '#f5c4bc',
          300: '#ec9a8e',
          400: '#d9675a',
          500: '#c2443a',
          600: '#a83024',
          700: '#8c271d',
          800: '#6f1f18',
          900: '#521712',
        },
        // Creme da caldeira (#FCF0D8)
        'creme': {
          50: '#fffdf8',
          100: '#fdf8ec',
          200: '#fcf0d8',
          300: '#f6e3bf',
          400: '#eed2a0',
          500: '#e2bd7f',
          600: '#c99d5c',
          700: '#a37b40',
          800: '#7d5d31',
          900: '#5c4425',
        },
        // Laranja da versão monocromática (#FC9000) - usado como latão/dourado
        'latao': {
          50: '#fff8eb',
          100: '#ffedc9',
          200: '#ffd994',
          300: '#ffc25a',
          400: '#fea72a',
          500: '#fc9000',
          600: '#d97400',
          700: '#b35a05',
          800: '#8f470b',
          900: '#753b0d',
        },
        // Azul da versão monocromática (#004878)
        'anil': {
          50: '#eef6fb',
          100: '#d6e8f4',
          200: '#aecfe7',
          300: '#7caed4',
          400: '#4688bb',
          500: '#1f6aa0',
          600: '#00578f',
          700: '#004878',
          800: '#003a61',
          900: '#002c4a',
        },
        // Cinza da fumaça (#CCD8D8)
        'fumaca': {
          50: '#f6f8f8',
          100: '#e9eeee',
          200: '#ccd8d8',
          300: '#adbdbd',
          400: '#8a9c9c',
          500: '#6c7f7f',
          600: '#556565',
          700: '#434f4f',
          800: '#323b3b',
          900: '#222828',
        },
        // Cinzas neutros aquecidos para combinar com o papel creme
        'gray': colors.stone,
      },
      fontFamily: {
        'display': ['Oswald', 'Arial Narrow', 'sans-serif'],
        'slab': ['"Alfa Slab One"', 'Georgia', 'serif'],
        'body': ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        'ticket': ['"Courier Prime"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'trilho-gradient': 'linear-gradient(135deg, #fdf8ec 0%, #fcf0d8 50%, #f6e3bf 100%)',
        'caldeira': 'linear-gradient(135deg, #63341f 0%, #48240c 55%, #331908 100%)',
        'vagao-gradient': 'linear-gradient(135deg, #c2443a 0%, #a83024 60%, #8c271d 100%)',
      },
      boxShadow: {
        'bilhete': '0 1px 0 rgba(72,36,12,0.08), 0 8px 24px -8px rgba(72,36,12,0.35)',
        'bilhete-hover': '0 1px 0 rgba(72,36,12,0.08), 0 16px 32px -10px rgba(72,36,12,0.45)',
      },
    },
  },
  plugins: [],
}
