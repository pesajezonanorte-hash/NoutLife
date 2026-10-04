import type { Config } from 'tailwindcss';

// Tokens del rediseño (docs/redesign/tokens/tailwind.tokens.ts). Los canales RGB
// viven en --lq-* (src/styles/tokens.css) para que funcionen los modificadores /10.
const c = (v: string) => `rgb(var(--lq-${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Backgrounds ────────────────────────────────────────────────────
        'bg-deep':        'var(--bg-deep)',
        'bg-panel':       'var(--bg-panel)',
        'bg-panel-light': 'var(--bg-panel-light)',
        'bg-card':        'var(--bg-card)',

        // ── Text ───────────────────────────────────────────────────────────
        'text-primary':   'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted':     'var(--text-muted)',

        // ── Borders ────────────────────────────────────────────────────────
        'border-pixel':   'var(--border)',

        // ── Accents Noutlife: dorado champagne (XP) + semánticos + neutros jade ─
        // Tonos medios para que los modificadores /15 /50 funcionen en ambos modos.
        'accent-gold':    '#b08d57',
        'accent-cyan':    '#6b8a78',
        'accent-pink':    '#8fae9c',
        'accent-green':   '#3a9b67',
        'accent-red':     '#c8463f',
        'accent-blue':    '#4f6b5c',
        'accent-purple':  '#548f6f',

        // ── Tokens semánticos shadcn (para componentes tipo shadcn: LiquidButton, etc.) ──
        // Mapeados a las CSS vars del tema LifeQuest (globals.css). No colisionan
        // con las keys anteriores ('text-primary' genera .text-text-primary, no .text-primary).
        'foreground':          'var(--text-primary)',
        'primary-foreground':  'var(--text-inv)',
        'secondary-foreground':'var(--text-primary)',
        'muted':               'var(--bg-muted)',
        'muted-foreground':    'var(--text-muted)',
        'accent':              'var(--bg-soft)',
        'accent-foreground':   'var(--text-primary)',
        'destructive':         'var(--accent-red)',
        'destructive-foreground': 'var(--text-inv)',
        'border-input':        'var(--border-strong)',
        'input':               'var(--border-strong)',
        'ring':                'var(--primary)',

        // ── Rediseño LifeQuest (README: bg-primary-strong, text-on-surface-light…) ──
        primary: { DEFAULT: c('primary'), strong: c('primary-strong'), hover: c('primary-hover'), text: c('primary-text') },
        'on-primary': c('on-primary'),
        jade: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((k) => [k, c(`jade-${k}`)])),
        // Oro champán: solo recompensas (XP, oro, premium, logros, pase).
        secondary: { DEFAULT: c('secondary'), text: c('secondary-text') },
        // Tono neutro de categoría (Mente, noche, servicios, El Sabio…), antes violeta.
        forest: { DEFAULT: c('forest'), text: c('forest-text') },
        success: { DEFAULT: c('success'), text: c('success-text'), strong: c('success-strong') },
        'on-success': c('on-success'),
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
        sans:  ['Montserrat', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        pixel: ['Montserrat', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono:  ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        vt:    ['Montserrat', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        pixel:       'var(--shadow-sm)',
        'pixel-lg':  'var(--shadow-md)',
        'pixel-inset': 'inset 0 1px 3px rgba(0,0,0,0.07)',
        'pixel-gold': '0 4px 14px rgba(176,141,87,0.25)',
        'pixel-red':  '0 4px 14px rgba(200,70,63,0.25)',
        'sm':         'var(--shadow-sm)',
        'md':         'var(--shadow-md)',
        'lg':         'var(--shadow-lg)',
      },
      // Radios del design system: sm 6 (chips) · md 10 (botones, inputs) · lg/2xl 16 (cards, modales).
      borderRadius: {
        'pixel': '12px',
        sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)',
        xl: '0.75rem', '2xl': 'var(--radius-lg)', '3xl': '1.5rem',
      },
      // Escala Noutlife (lq.css .t-*). Las clases heredadas que ya usan las páginas
      // conservan su nombre con los valores del design system:
      //   display-lg = .t-dl 56 · display-md = .t-dm 40 · display-sm = .t-ds 32
      //   heading-lg = .t-hl 24 · heading-md = .t-hm 20 · heading-sm = .t-hs 18
      //   body-lg = .t-bl 16 · body-md = .t-bm 15 · body-sm = .t-bs 14
      //   label-lg = .t-ll 14 · label-md = .t-lm 12 · caption = .t-cap 12
      // y se añaden los alias del README v4 (hero-lg, hero-md, display, heading-xl, body, label-sm, stat).
      fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-md': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-sm': ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading-lg': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em', fontWeight: '700' }],
        'heading-md': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-sm': ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['1rem', { lineHeight: '1.5rem' }],
        'body-md': ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '-0.01em' }],
        'body-sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'label-lg': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '600' }],
        'label-md': ['0.75rem', { lineHeight: '1.125rem', letterSpacing: '0.01em', fontWeight: '600' }],
        caption: ['0.75rem', { lineHeight: '1.125rem' }],
        // Alias README v4
        'hero-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'hero-md': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        display: ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading-xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em', fontWeight: '700' }],
        body: ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '-0.01em' }],
        'label-sm': ['0.75rem', { lineHeight: '1.125rem', fontWeight: '600' }],
        stat: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '500' }],
      },
      transitionTimingFunction: { out: 'cubic-bezier(0, 0, 0.2, 1)', expo: 'cubic-bezier(.16, 1, .3, 1)', spring: 'cubic-bezier(.34, 1.56, .64, 1)' },
      animation: {
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'shake': 'shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'float-up': 'floatUp 1.5s ease-out forwards',
        'pixel-flash': 'pixelFlash 0.3s ease-out',
        'xp-fill': 'xpFill 0.8s ease-out forwards',
        'typewriter': 'typewriter 2s steps(40) forwards',
        'idle-breathe': 'idleBreathe 3s ease-in-out infinite',
        'grow-x': 'grow-x .9s cubic-bezier(0,0,.2,1) .2s both',
        'grow-y': 'grow-y .8s cubic-bezier(.2,.8,.2,1) both',
        sheen: 'sheen 2.6s ease-in-out 1.4s infinite',
        halo: 'halo 2.8s cubic-bezier(0,0,.2,1) 1s infinite',
        float: 'float 6s ease-in-out infinite',
        beat: 'beat 2s ease-in-out infinite',
        shimmer: 'shimmer 1.4s linear infinite',
        confetti: 'confetti-fall 1.8s cubic-bezier(0,0,.2,1) forwards',
      },
      keyframes: {
        bounceIn: {
          '0%': { transform: 'scale(0) translateY(-20px)', opacity: '0' },
          '60%': { transform: 'scale(1.15) translateY(5px)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        floatUp: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-60px)', opacity: '0' },
        },
        pixelFlash: {
          '0%': { filter: 'brightness(1)' },
          '50%': { filter: 'brightness(2)' },
          '100%': { filter: 'brightness(1)' },
        },
        xpFill: {
          '0%': { width: 'var(--xp-start, 0%)' },
          '100%': { width: 'var(--xp-end, 100%)' },
        },
        'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        'grow-y': { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
        sheen: { '0%': { transform: 'translateX(-100%)' }, '60%,100%': { transform: 'translateX(100%)' } },
        halo: { '0%': { transform: 'scale(.92)', opacity: '.55' }, '100%': { transform: 'scale(1.22)', opacity: '0' } },
        float: { '50%': { transform: 'translateY(-6px)' } },
        beat: { '50%': { transform: 'scale(1.5)', opacity: '.5' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        'confetti-fall': { '0%': { transform: 'translateY(0) rotate(0)', opacity: '1' }, '100%': { transform: 'translateY(420px) rotate(540deg)', opacity: '0' } },
        idleBreathe: {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(0.97)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
