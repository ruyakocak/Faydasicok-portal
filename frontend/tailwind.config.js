/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#E0221D',  // Main brand color
          600: '#c41f1a',
          700: '#a81b16',
          800: '#8c1712',
          900: '#70120e',
          950: '#540d0a',
        },
        gray: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        status: {
          approved:        '#1E7E34',
          'approved-bg':   '#D4EDDA',
          'approved-text': '#155724',
          pending:         '#B58105',
          'pending-bg':    '#FFF3CD',
          'pending-text':  '#856404',
          rejected:        '#C0392B',
          'rejected-bg':   '#F8D7DA',
          'rejected-text': '#721C24',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['0.9375rem',{ lineHeight: '1.5rem' }],
        'lg':   ['1.0625rem',{ lineHeight: '1.75rem' }],
        'xl':   ['1.125rem', { lineHeight: '1.75rem' }],
        '2xl':  ['1.25rem',  { lineHeight: '1.75rem' }],
        '3xl':  ['1.5rem',   { lineHeight: '2rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      boxShadow: {
        'card':  '0 1px 2px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.08)',
        'modal': '0 20px 60px rgba(0,0,0,0.20)',
        'dropdown': '0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        DEFAULT: '8px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
