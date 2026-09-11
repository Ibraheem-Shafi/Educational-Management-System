/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './screens/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        navy: '#0b1f3a',
        teal: '#0d9b8a',
        orange: '#f06d2a',
        yellow: '#d4a017',
        green: '#22a06b',
        coral: '#f07167',
        purple: '#7c5cfc',
        canvas: '#f7f9fb',
        ink: '#0a0d14',
        muted: '#525866',
        line: '#e2e4e9',
      },
    },
  },
  plugins: [],
};
