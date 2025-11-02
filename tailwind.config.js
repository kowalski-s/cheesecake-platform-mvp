/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#f78c1f',
          soft: '#f7a64f',
          muted: '#e87c14',
        },
        surface: {
          DEFAULT: '#ffffff',
          light: '#f7f7f7',
          dark: '#f0f0f0',
        },
        text: {
          DEFAULT: '#1f2937',
          muted: '#6b7280',
        },
      },
      boxShadow: {
        soft: '0 4px 14px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        xl: '16px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      container: {
        center: true,
        padding: '1rem',
      },
    },
  },
  plugins: [],
}