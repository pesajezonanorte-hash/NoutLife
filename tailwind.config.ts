import type { Config } from 'tailwindcss';

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

        // ── Accents B&N: dorado XP sutil + semánticos tenues + grises ───────
        // Tonos medios para que los modificadores /15 /50 funcionen en ambos modos.
        'accent-gold':    '#a8871e',
        'accent-cyan':    '#7c7c85',
        'accent-pink':    '#8f8f98',
        'accent-green':   '#4a825f',
        'accent-red':     '#b5453a',
        'accent-blue':    '#71717a',
        'accent-purple':  '#6b6b73',

        // ── Tokens semánticos shadcn (para componentes tipo shadcn: LiquidButton, etc.) ──
        // Mapeados a las CSS vars del tema LifeQuest (globals.css). No colisionan
        // con las keys anteriores ('text-primary' genera .text-text-primary, no .text-primary).
        'background':          'var(--bg-deep)',
        'foreground':          'var(--text-primary)',
        'primary':             'var(--primary)',
        'primary-foreground':  'var(--text-inv)',
        'secondary':           'var(--bg-panel-light)',
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
        // `border` como color semántico (clase .border-border, estilo shadcn)
        'border':              'var(--border)',
      },
      fontFamily: {
        sans:  ['Montserrat', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        pixel: ['Montserrat', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        vt:    ['Montserrat', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        pixel:       'var(--shadow-sm)',
        'pixel-lg':  'var(--shadow-md)',
        'pixel-inset': 'inset 0 1px 3px rgba(0,0,0,0.07)',
        'pixel-gold': '0 4px 14px rgba(245,158,11,0.25)',
        'pixel-red':  '0 4px 14px rgba(239,68,68,0.25)',
        'sm':         'var(--shadow-sm)',
        'md':         'var(--shadow-md)',
        'lg':         'var(--shadow-lg)',
      },
      borderRadius: {
        'pixel': '12px',
      },
      animation: {
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'shake': 'shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'float-up': 'floatUp 1.5s ease-out forwards',
        'pixel-flash': 'pixelFlash 0.3s ease-out',
        'xp-fill': 'xpFill 0.8s ease-out forwards',
        'typewriter': 'typewriter 2s steps(40) forwards',
        'idle-breathe': 'idleBreathe 3s ease-in-out infinite',
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
        idleBreathe: {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(0.97)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
