// Acerca de Noutlife: qué es, por qué existe, con qué propósito y quién lo hace.
// Estética minimalista con el logo como protagonista (flota dentro de un anillo
// de luz que gira), titular que entra palabra a palabra y secciones que aparecen
// al desplazarse. Solo transform/opacity; quieto con «Reducir movimiento».
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Compass, HeartHandshake, Instagram, LifeBuoy, ShieldCheck, Sparkles, Swords, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { expo, item, springSoft, stagger } from '@/lib/motion';
import { Card, SpotCard } from '@/components/ui/lq';
import { buttonClasses } from '@/components/ui/lq/Button';
import { BrandMark } from '@/components/layout/Brand';

const CREATOR = { name: 'Miguel Angel Romero', initials: 'MR', instagram: 'miguxlxr' };

const TAGLINE = 'Tu vida real, jugada como la mejor partida.';

const PILLARS = [
  { icon: Swords, title: 'Una aventura, no una lista', text: 'Hábitos, misiones, finanzas, sueño o gimnasio dejan de ser tareas sueltas: cada avance suma XP, sube tu nivel y hace crecer a tu personaje.' },
  { icon: Target, title: 'Constancia antes que perfección', text: 'Las rachas, los rituales y los pequeños logros premian volver cada día, aunque sea un poco. El progreso se construye así.' },
  { icon: Compass, title: 'Toda tu vida en un lugar', text: 'Ver tus zonas juntas te ayuda a notar qué va bien, qué se está quedando atrás y dónde poner la energía esta semana.' },
  { icon: ShieldCheck, title: 'Tus datos son tuyos', text: 'Puedes exportar todo lo que registras o borrarlo cuando quieras desde Ajustes.' },
] as const;

/** Sección que aparece al entrar en pantalla. */
function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, ease: expo, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-label-lg uppercase tracking-[0.14em] text-primary-text">{children}</span>;
}

function LogoHero() {
  return (
    <div className="relative mx-auto flex size-40 items-center justify-center md:size-48">
      {/* Anillo de luz que gira + halo que respira */}
      <span aria-hidden className="lq-spin-slow absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgb(var(--lq-primary)/.0),rgb(var(--lq-primary)/.55),rgb(var(--lq-secondary)/.0),rgb(var(--lq-secondary)/.5),rgb(var(--lq-primary)/.0))] p-px [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),black_calc(100%-1px))]" />
      <span aria-hidden className="lq-breathe absolute inset-4 rounded-full bg-[radial-gradient(circle,rgb(var(--lq-primary)/.22),transparent_70%)]" />
      <motion.span
        initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.1 }}
        className="relative"
      >
        <BrandMark alt="Logo de Noutlife" className="animate-float [.reduce-motion_&]:animate-none size-24 rounded-[28px] shadow-lg md:size-28" />
      </motion.span>
    </div>
  );
}

export default function AboutPage() {
  const words = TAGLINE.split(' ');
  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="mx-auto flex max-w-4xl flex-col gap-16 pb-8 md:gap-24">
      {/* Hero */}
      <motion.section variants={item} aria-labelledby="about-title" className="flex flex-col items-center gap-6 pt-4 text-center md:pt-10">
        <LogoHero />
        <div className="flex flex-col items-center gap-4">
          <Eyebrow>Acerca de</Eyebrow>
          <h1 id="about-title" className="text-display-md md:text-display-lg">Noutlife</h1>
          <p className="max-w-xl text-heading-sm font-medium text-on-surface md:text-heading-md" aria-label={TAGLINE}>
            {words.map((w, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="inline-block"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springSoft, delay: 0.45 + i * 0.07 }}
              >
                {w}{i < words.length - 1 ? ' ' : ''}
              </motion.span>
            ))}
          </p>
        </div>
      </motion.section>

      {/* Qué es / por qué */}
      <Reveal className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-14">
        <div className="flex flex-col gap-3">
          <Eyebrow>Por qué existe</Eyebrow>
          <h2 className="text-heading-lg md:text-display-sm">Mejorar es fácil de empezar y difícil de sostener.</h2>
        </div>
        <div className="flex flex-col gap-4 text-body-lg text-on-surface">
          <p>
            Todos hemos empezado un hábito con ganas y lo hemos dejado a las dos semanas. Los videojuegos, en cambio, saben
            exactamente cómo hacer que quieras volver: metas claras, progreso visible y recompensas por cada paso.
          </p>
          <p>
            Noutlife toma esas mismas ideas y las pone al servicio de tu vida real. Tú eres el personaje; tus hábitos,
            tus metas y tu descanso son la partida.
          </p>
        </div>
      </Reveal>

      {/* Propósito */}
      <section aria-labelledby="about-purpose" className="flex flex-col gap-8">
        <Reveal className="flex flex-col items-center gap-3 text-center">
          <Eyebrow>Propósito</Eyebrow>
          <h2 id="about-purpose" className="max-w-2xl text-heading-lg md:text-display-sm">Ayudarte a construir tu mejor versión, un día a la vez.</h2>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <SpotCard as="article" padding="md" className="flex h-full flex-col gap-4">
                <motion.span
                  whileHover={{ scale: 1.1, rotate: -6 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                  className="flex size-12 items-center justify-center rounded-2xl bg-primary/[var(--lq-soft-alpha)] text-primary-text"
                >
                  <p.icon aria-hidden className="size-6" strokeWidth={1.75} />
                </motion.span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-heading-sm">{p.title}</h3>
                  <p className="text-body-md text-on-surface-light">{p.text}</p>
                </div>
              </SpotCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Quién lo hace */}
      <Reveal>
        <Card variant="elevated" padding="none" className="relative isolate overflow-hidden p-6 md:p-10">
          <span aria-hidden className="lq-breathe absolute -right-24 -top-24 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgb(var(--lq-secondary)/.18),transparent_65%)]" />
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
            <motion.span
              initial={{ scale: 0.7, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 260, damping: 14 }}
              aria-hidden
              className="flex size-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-heading-md font-bold text-on-primary shadow-lg"
            >
              {CREATOR.initials}
            </motion.span>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <Eyebrow>Quién lo hace</Eyebrow>
              <h2 className="text-heading-lg">{CREATOR.name}</h2>
              <p className="text-body-md text-on-surface">
                Noutlife es un proyecto independiente, diseñado y desarrollado por una sola persona que quería una forma
                más motivadora de cuidar sus hábitos, su dinero, su cuerpo y su mente. Cada pantalla está hecha con la
                misma idea: que avanzar se sienta bien.
              </p>
              <motion.a
                href={`https://instagram.com/${CREATOR.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                className={cn(buttonClasses('secondary', 'md'), 'w-fit')}
              >
                <Instagram aria-hidden className="size-5" strokeWidth={1.75} />@{CREATOR.instagram}
                <span className="sr-only"> (Instagram, se abre en otra pestaña)</span>
              </motion.a>
            </div>
          </div>
        </Card>
      </Reveal>

      {/* Cierre */}
      <Reveal className="flex flex-col items-center gap-5 text-center">
        <Sparkles aria-hidden className="size-6 text-primary-text" strokeWidth={1.75} />
        <p className="max-w-lg text-body-lg text-on-surface">Gracias por jugar. Cada día que vuelves, tu personaje —y tú— sube un poco más.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/" className={buttonClasses('primary', 'md')}><HeartHandshake aria-hidden className="size-5" strokeWidth={1.75} />Seguir mi aventura</Link>
          <Link to="/faq" className={buttonClasses('ghost', 'md')}><LifeBuoy aria-hidden className="size-5" strokeWidth={1.75} />Ayuda</Link>
        </div>
        <span className="flex items-center gap-2 text-body-sm text-on-surface-light">
          <BrandMark className="size-6 rounded-md" />
          © {new Date().getFullYear()} Noutlife · {CREATOR.name}
        </span>
      </Reveal>
    </motion.div>
  );
}
