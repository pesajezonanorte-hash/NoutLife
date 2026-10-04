// Playground del rediseño (solo desarrollo, ruta /_ui). Muestra los tokens de
// docs/redesign y, desde la fase 2, los componentes de src/components/ui.
import { motion } from 'framer-motion';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { item, page, stagger } from '@/lib/motion';
import { SegmentedControl, Toaster } from '@/components/ui/lq';
import { ComponentsDemo } from './ComponentsDemo';

const swatches = [
  ['primary', 'bg-primary'],
  ['primary-strong', 'bg-primary-strong'],
  ['secondary', 'bg-secondary'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['error', 'bg-error'],
  ['info', 'bg-info'],
  ['background', 'bg-background'],
  ['surface', 'bg-surface'],
  ['surface-variant', 'bg-surface-variant'],
  ['on-surface', 'bg-on-surface'],
  ['on-surface-light', 'bg-on-surface-light'],
] as const;

const textTokens = [
  ['primary-text', 'text-primary-text'],
  ['secondary-text', 'text-secondary-text'],
  ['success-text', 'text-success-text'],
  ['warning-text', 'text-warning-text'],
  ['error-text', 'text-error-text'],
  ['info-text', 'text-info-text'],
] as const;

const typeScale = [
  ['display-lg', 'text-display-lg', 'Nivel 12 alcanzado'],
  ['display-md', 'text-display-md', 'Tus hábitos de hoy'],
  ['display-sm', 'text-display-sm', 'Buenos días, Alex'],
  ['heading-lg', 'text-heading-lg', 'Misiones activas'],
  ['heading-md', 'text-heading-md', 'Racha de 14 días'],
  ['heading-sm', 'text-heading-sm', 'Historial de duelos'],
  ['body-lg', 'text-body-lg', 'Completa tus hábitos para ganar experiencia.'],
  ['body-md', 'text-body-md', 'Comienza con un objetivo pequeño y constante.'],
  ['body-sm', 'text-body-sm', 'Actualizado hace 5 min · 3 de 5 completados'],
  ['label-lg', 'text-label-lg', 'Completar misión'],
  ['label-md', 'text-label-md', 'EN PROGRESO · +150 XP'],
  ['caption', 'text-caption', 'hace 2 h — solo timestamps'],
] as const;

const modes: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'auto', label: 'Auto' },
];

export default function UIPlayground() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <motion.main
      variants={page}
      initial="initial"
      animate="animate"
      className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 bg-background px-4 py-8 text-on-background sm:px-6 lg:px-8 lg:py-12"
    >
      <header className="flex flex-col gap-4">
        <span className="text-label-lg text-primary-text">Design System · Fundamentos</span>
        <h1 className="text-display-sm lg:text-display-lg">Tokens Noutlife</h1>
        <SegmentedControl role="radiogroup" label="Tema" value={mode} onChange={setMode} options={modes} className="max-w-sm" />
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-heading-md">Color</h2>
        <motion.ul
          variants={stagger}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {swatches.map(([name, cls]) => (
            <motion.li
              key={name}
              variants={item}
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
            >
              <div className={`h-16 ${cls}`} />
              <div className="px-3 py-2 text-label-lg">{name}</div>
            </motion.li>
          ))}
        </motion.ul>
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-border bg-surface p-4">
          {textTokens.map(([name, cls]) => (
            <span key={name} className={`text-label-lg ${cls}`}>{name}</span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-heading-md">Tipografía</h2>
        <div className="overflow-hidden rounded-2xl border border-border">
          {typeScale.map(([token, cls, sample]) => (
            <div
              key={token}
              className="flex flex-col gap-1 border-t border-border bg-background px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:gap-6"
            >
              <span className="w-28 shrink-0 font-mono text-body-sm text-primary-text">{token}</span>
              <span className={`${cls} truncate`}>{sample}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-heading-md">Elevación y movimiento</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(['shadow-sm', 'shadow-md', 'shadow-lg'] as const).map((s) => (
            <motion.div
              key={s}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className={`flex h-24 items-end rounded-2xl border border-border bg-background p-4 ${s}`}
            >
              <span className="text-label-lg">{s}</span>
            </motion.div>
          ))}
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-variant" role="progressbar" aria-label="Ejemplo" aria-valuenow={72} aria-valuemin={0} aria-valuemax={100}>
          <motion.span
            className="block h-full rounded-full bg-primary"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 0.72 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0, 0, 0.2, 1] }}
            style={{ originX: 0 }}
          />
        </div>
      </section>

      <ComponentsDemo />
      <Toaster />
    </motion.main>
  );
}
