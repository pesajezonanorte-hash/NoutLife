// Merge into apps/web/tailwind.config.ts → theme.extend (keep existing content/plugins).
// Values follow the LifeQuest Design System (design-system/tokens.json).
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
  fontFamily: {
    sans: ['Montserrat', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace'],           // numbers: XP, Gold, timers, stats
  },
  fontSize: {
    // Design-system scale (UI)
    display: ['2rem', { lineHeight: '2.5rem', fontWeight: '700' }],          // 32/40
    'heading-xl': ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],     // 24/32
    'heading-lg': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }], // 20/28
    'heading-md': ['1.125rem', { lineHeight: '1.625rem', fontWeight: '600' }], // 18/26
    'body-lg': ['1rem', { lineHeight: '1.5rem' }],                           // 16/24
    'body-md': ['0.9375rem', { lineHeight: '1.375rem' }],                    // 15/22
    'body-sm': ['0.875rem', { lineHeight: '1.25rem' }],                      // 14/20
    'label-md': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '600' }],  // 14/20
    'label-sm': ['0.75rem', { lineHeight: '1.125rem', fontWeight: '600' }],  // 12/18
    caption: ['0.75rem', { lineHeight: '1.125rem' }],                        // 12/18
    // Redesign hero sizes — page titles and hero numbers only (see README §Tipografía)
    'hero-lg': ['3.5rem', { lineHeight: '1.2', letterSpacing: '-0.5px', fontWeight: '700' }],  // 56
    'hero-md': ['2.75rem', { lineHeight: '1.3', letterSpacing: '-0.3px', fontWeight: '700' }], // 44
    'hero-sm': ['2.25rem', { lineHeight: '1.4', letterSpacing: '-0.2px', fontWeight: '600' }], // 36
  },
  borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)', full: 'var(--radius-full)' },
  boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
  transitionTimingFunction: { out: 'cubic-bezier(0, 0, 0.2, 1)', spring: 'cubic-bezier(.3, 1.3, .5, 1)' },
  keyframes: {
    'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
    'grow-y': { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
    sheen: { '0%': { transform: 'translateX(-100%)' }, '60%,100%': { transform: 'translateX(100%)' } },
    halo: { '0%': { transform: 'scale(.92)', opacity: '.55' }, '100%': { transform: 'scale(1.22)', opacity: '0' } },
    float: { '50%': { transform: 'translateY(-6px)' } },
    beat: { '50%': { transform: 'scale(1.5)', opacity: '.5' } },
    shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
    'confetti-fall': { '0%': { transform: 'translateY(0) rotate(0)', opacity: '1' }, '100%': { transform: 'translateY(420px) rotate(540deg)', opacity: '0' } },
  },
  animation: {
    'grow-x': 'grow-x .9s cubic-bezier(0,0,.2,1) .2s both',
    'grow-y': 'grow-y .8s cubic-bezier(.2,.8,.2,1) both',
    sheen: 'sheen 2.6s ease-in-out 1.4s infinite',
    halo: 'halo 2.8s cubic-bezier(0,0,.2,1) 1s infinite',
    float: 'float 6s ease-in-out infinite',
    beat: 'beat 2s ease-in-out infinite',
    shimmer: 'shimmer 1.4s linear infinite',
    confetti: 'confetti-fall 1.8s cubic-bezier(0,0,.2,1) forwards',
  },
};
