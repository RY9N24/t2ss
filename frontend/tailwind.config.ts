import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0f131a',
        surface: '#161c24',
        primary: '#fba918',
        secondary: '#2a3340',
        success: '#16a34a',
        danger: '#dc2626',
      },
    },
  },
  plugins: [],
};

export default config;
