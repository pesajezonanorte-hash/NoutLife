// Merge into apps/web/tailwind.config.ts → theme.extend (keep existing content/plugins).
// Usage: bg-primary-strong text-on-primary, bg-primary/10 text-primary-text, text-display-lg, shadow-lg, animate-grow-x
import type { Config } from 'tailwindcss';

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

export const lifequestTheme: NonNullable<Config['theme']>['extend'] = {
  colors: {
    primary: { DEFAULT: c('primary'), strong: c('primary-strong'), hover: c('primary-hover'), text: c('primary-text') },
    'on-primary': c('on-primary'),
    secondary: { DEFAULT: c('secondary'), text: c('secondary-text') },
    success: { DEFAULT: c('success'), text: c('success-text') },
    warning: { DEFAULT: c('warning'), text: c('warning-text') },
    error: { DEFAULT: c('error'), text: c('error-text') },
    info: { DEFAULT: c('info'), text: c('info-text') },
    background: c('background'),
    surface: { DEFAULT: c('surface'), variant: c('surface-variant') },
    border: { DEFAULT: c('border'), strong: c('border-strong') },
    'on-background': c('on-background'),
    'on-surface': { DEFAULT: c('on-surface'), light: c('on-surface-light') },
  },
  fontFamily: { sans: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
  fontSize: {
    'display-lg': ['3.5rem', { lineHeight: '1.2', letterSpacing: '-0.5px', fontWeight: '700' }],
    'display-md': ['2.75rem', { lineHeight: '1.3', letterSpacing: '-0.3px', fontWeight: '700' }],
    'display-sm': ['2.25rem', { lineHeight: '1.4', letterSpacing: '-0.2px', fontWeight: '600' }],
    'heading-lg': ['1.75rem', { lineHeight: '1.5', fontWeight: '600' }],
    'heading-md': ['1.5rem', { lineHeight: '1.5', fontWeight: '600' }],
    'heading-sm': ['1.25rem', { lineHeight: '1.6', fontWeight: '600' }],
    'body-lg': ['1.125rem', { lineHeight: '1.6' }],
    'body-md': ['1rem', { lineHeight: '1.6' }],
    'body-sm': ['0.875rem', { lineHeight: '1.6' }],
    'label-lg': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.1px', fontWeight: '600' }],
    'label-md': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.1px', fontWeight: '600' }],
    caption: ['0.625rem', { lineHeight: '1.4', letterSpacing: '0.2px', fontWeight: '500' }],
  },
  borderRadius: { lg: '0.5rem', xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem' },
  boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
  transitionTimingFunction: { out: 'cubic-bezier(0, 0, 0.2, 1)', spring: 'cubic-bezier(.3, 1.3, .5, 1)' },
  keyframes: {
    'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
    'grow-y': { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
    sheen: { '0%': { transform: 'translateX(-100%)' }, '60%,100%': { transform: 'translateX(100%)' } },
    halo: { '0%': { transform: 'scale(.92)', opacity: '.55' }, '100%': { transform: 'scale(1.22)', opacity: '0' } },
    float: { '50%': { transform: 'translateY(-6px)' } },
    shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
    'confetti-fall': { '0%': { transform: 'translateY(0) rotate(0)', opacity: '1' }, '100%': { transform: 'translateY(420px) rotate(540deg)', opacity: '0' } },
  },
  animation: {
    'grow-x': 'grow-x .9s cubic-bezier(0,0,.2,1) .2s both',
    'grow-y': 'grow-y .8s cubic-bezier(.2,.8,.2,1) both',
    sheen: 'sheen 2.6s ease-in-out 1.4s infinite',
    halo: 'halo 2.8s cubic-bezier(0,0,.2,1) 1s infinite',
    float: 'float 6s ease-in-out infinite',
    shimmer: 'shimmer 1.4s linear infinite',
    confetti: 'confetti-fall 1.8s cubic-bezier(0,0,.2,1) forwards',
  },
};
