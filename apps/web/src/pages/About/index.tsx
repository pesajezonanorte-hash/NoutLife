// Acerca de Noutlife: qué es, por qué existe, con qué propósito y quién lo hace.
// Zona ambientada: un museo. La pieza central es el logo sobre un pedestal de
// mármol bajo su foco; después, un recorrido por salas que se revelan al llegar
// (el foco se enciende y la pieza sube a la pared): el origen como texto de sala
// junto a un cuadro, el propósito como cuatro cuadros con su placa, el autor como
// retrato, la historia del proyecto (pendiente de contenido) y la salida. La línea
// del recorrido se dibuja a medida que avanzas y enciende cada parada.
// Solo transform/opacity; quieto con «Reducir movimiento».
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Compass, HeartHandshake, Instagram, LifeBuoy, ShieldCheck, Sparkles, Swords, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, springSoft } from '@/lib/motion';
import { buttonClasses } from '@/components/ui/lq/Button';
import { BrandMark } from '@/components/layout/Brand';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { Frame, Pedestal, Plaque, Room, TourLine } from '@/components/about/Museum';

const CREATOR = { name: 'Miguel Angel Romero', initials: 'MR', instagram: 'miguxlxr' };

const TAGLINE = 'Tu vida real, jugada como la mejor partida.';

const PILLARS = [
  { icon: Swords, title: 'Una aventura, no una lista', text: 'Hábitos, misiones, finanzas, sueño o gimnasio dejan de ser tareas sueltas: cada avance suma XP, sube tu nivel y hace crecer a tu personaje.', tone: 'bg-primary/[var(--lq-soft-alpha)] text-primary-text' },
  { icon: Target, title: 'Constancia antes que perfección', text: 'Las rachas, los rituales y los pequeños logros premian volver cada día, aunque sea un poco. El progreso se construye así.', tone: 'bg-warning/[var(--lq-soft-alpha)] text-warning-text' },
  { icon: Compass, title: 'Toda tu vida en un lugar', text: 'Ver tus zonas juntas te ayuda a notar qué va bien, qué se está quedando atrás y dónde poner la energía esta semana.', tone: 'bg-info/[var(--lq-soft-alpha)] text-info-text' },
  { icon: ShieldCheck, title: 'Tus datos son tuyos', text: 'Puedes exportar todo lo que registras o borrarlo cuando quieras desde Ajustes.', tone: 'bg-success/[var(--lq-soft-alpha)] text-success-text' },
] as const;

// TODO(contenido): la historia del proyecto no está escrita en ningún sitio. Cuando
// exista (fechas, versiones, momentos clave), reemplaza estos hitos por los reales.
const MILESTONES = [1, 2, 3];

/** El cuadro de la sala del origen: un camino que sube entre colinas hacia el sol. */
function OriginPainting() {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 180" className="block size-full">
      <rect width="240" height="180" className="fill-jade-50 dark:fill-jade-900" />
      <circle cx="176" cy="54" r="22" className="fill-secondary/80" />
      <path d="M0 130C40 96 80 104 120 118S200 92 240 104V180H0Z" className="fill-jade-300/70 dark:fill-jade-700/70" />
      <path d="M0 150C50 128 100 140 150 134S210 122 240 130V180H0Z" className="fill-jade-500/70 dark:fill-jade-800" />
      <path d="M40 180C70 160 96 150 112 136S150 112 168 86" className="fill-none stroke-secondary-text" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />
    </svg>
  );
}

export default function AboutPage() {
  const words = TAGLINE.split(' ');
  return (
    <ZoneShell
      zone="about"
      className="mx-auto w-full max-w-4xl"
      contentClassName="gap-20 pb-8 md:gap-28"
      ambience={<AmbientLight tone="secondary" alpha={0.1} darkAlpha={0.06} d={16} className="left-[15%] top-[-4%] h-[34rem] w-[70%]" />}
    >
      {/* La pieza central: el logo en su pedestal, bajo el foco */}
      <motion.section variants={item} aria-labelledby="about-title" className="relative flex flex-col items-center gap-8 pt-4 text-center md:pt-8">
        <motion.span
          aria-hidden="true"
          className="lq-gallery-spot pointer-events-none absolute inset-x-0 -top-8 mx-auto block h-[28rem] w-[min(34rem,100%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.5, 1], transition: { duration: 0.9, times: [0, 0.3, 0.5, 1], delay: 0.25 } }}
        />
        <Pedestal>
          <motion.span
            initial={{ opacity: 0, scale: 0.85, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.35 }}
            className="relative block"
          >
            <BrandMark tile alt="Logo de Noutlife" className="animate-float [.reduce-motion_&]:animate-none size-24 rounded-[28px] shadow-lg md:size-28" />
          </motion.span>
        </Pedestal>
        <div className="flex flex-col items-center gap-4">
          <span className="text-label-lg text-primary-text">Acerca de</span>
          <h1 id="about-title" className="text-display-md md:text-display-lg">Noutlife</h1>
          <p className="max-w-xl text-heading-sm font-medium text-on-surface md:text-heading-md" aria-label={TAGLINE}>
            {words.map((w, i) => (
              <motion.span key={i} aria-hidden className="inline-block" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springSoft, delay: 0.55 + i * 0.07 }}>
                {w}{i < words.length - 1 ? ' ' : ''}
              </motion.span>
            ))}
          </p>
        </div>
      </motion.section>

      <TourLine>
        {/* Sala 1: el origen */}
        <Room n={1} label="El origen" id="about-why">
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-12">
            <div className="flex flex-col gap-4">
              <h2 id="about-why" className="text-heading-lg md:text-display-sm">Mejorar es fácil de empezar y difícil de sostener.</h2>
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
            </div>
            <Frame className="aspect-[4/3]"><OriginPainting /></Frame>
          </div>
        </Room>

        {/* Sala 2: el propósito, cuatro cuadros con su placa */}
        <Room n={2} label="El propósito" id="about-purpose">
          <h2 id="about-purpose" className="max-w-2xl text-heading-lg md:text-display-sm">Ayudarte a construir tu mejor versión, un día a la vez.</h2>
          <ul className="grid gap-10 sm:grid-cols-2">
            {PILLARS.map((p, i) => (
              <motion.li
                key={p.title}
                className="group flex flex-col gap-4"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ ...springSoft, delay: i * 0.08 }}
              >
                <Frame kind={i % 2 ? 'wood' : 'gold'} className="aspect-[5/3] transition-transform duration-[900ms] ease-[var(--lq-ease-heavy)] group-hover:-translate-y-1">
                  <span aria-hidden="true" className={cn('flex size-full items-center justify-center', p.tone)}>
                    <p.icon className="size-14 transition-transform duration-[900ms] ease-[var(--lq-ease-heavy)] group-hover:scale-110" strokeWidth={1.25} />
                  </span>
                </Frame>
                <Plaque title={p.title}><p>{p.text}</p></Plaque>
              </motion.li>
            ))}
          </ul>
        </Room>

        {/* Sala 3: el autor, su retrato */}
        <Room n={3} label="El autor" id="about-author">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-12">
            <Frame kind="wood" className="aspect-[4/5] w-48 shrink-0 md:w-56">
              <span aria-hidden="true" className="flex size-full items-center justify-center bg-primary-strong text-display-sm font-bold text-on-primary">{CREATOR.initials}</span>
            </Frame>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <Plaque title={CREATOR.name} as="h2" className="self-start">
                <p id="about-author">Quién lo hace</p>
              </Plaque>
              <p className="text-body-lg text-on-surface">
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
        </Room>

        {/* Sala 4: la historia del proyecto (sin contenido todavía: no se inventa) */}
        <Room n={4} label="La historia" id="about-history">
          <h2 id="about-history" className="text-heading-lg md:text-display-sm">La historia del proyecto</h2>
          <p className="max-w-2xl text-body-lg text-on-surface">Esta sala espera los hitos del proyecto: sus primeros pasos, sus versiones y los momentos clave.</p>
          <ul className="grid gap-4 sm:grid-cols-3">
            {MILESTONES.map((m) => (
              <li key={m} className="lq-pending-exhibit flex flex-col gap-1 p-5 text-center">
                <span className="font-mono text-label-md text-on-surface">Hito {m}</span>
                <span className="text-body-sm text-on-surface">Pendiente de contenido: fecha y descripción.</span>
              </li>
            ))}
          </ul>
        </Room>

        {/* Sala 5: la salida */}
        <Room n={5} label="Salida" id="about-exit" className="items-center">
          <div className="flex flex-col items-center gap-5 text-center">
            <Sparkles aria-hidden className="size-6 text-primary-text" strokeWidth={1.75} />
            <h2 id="about-exit" className="sr-only">Salida</h2>
            <p className="max-w-lg text-body-lg text-on-surface">Gracias por jugar. Cada día que vuelves, tu personaje —y tú— sube un poco más.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/" className={buttonClasses('primary', 'md')}><HeartHandshake aria-hidden className="size-5" strokeWidth={1.75} />Seguir mi aventura</Link>
              <Link to="/faq" className={buttonClasses('ghost', 'md')}><LifeBuoy aria-hidden className="size-5" strokeWidth={1.75} />Ayuda</Link>
            </div>
            <span className="flex items-center gap-2 text-body-sm text-on-surface-light">
              <BrandMark size={24} />
              © {new Date().getFullYear()} Noutlife · {CREATOR.name}
            </span>
          </div>
        </Room>
      </TourLine>
    </ZoneShell>
  );
}
