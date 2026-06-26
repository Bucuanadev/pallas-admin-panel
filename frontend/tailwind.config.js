/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f8ff',
          100: '#e8f0ff',
          500: '#2563eb',
          700: '#1d4ed8',
          900: '#172554',
          gold: '#E8B73B',
          warm: '#F5F1E8',
          alert: '#E0524A'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      backgroundColor: {
        surface: '#0B0B0C'
      }
    }
  },
  plugins: []
};
