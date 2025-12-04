/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../lib/src/**/*.{js,ts,jsx,tsx}',
    '../narrative-app/src/**/*.{js,ts,jsx,tsx}',
    '../market-app/src/**/*.{js,ts,jsx,tsx}',
    '../map-app/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['light', 'dark'],
    darkTheme: 'dark',
    base: true,
    styled: true,
    utils: true,
  },
};
