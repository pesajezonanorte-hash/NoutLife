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
import { Compass, HeartHandshake, Instagram, Leaf, LifeBuoy, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, springSoft } from '@/lib/motion';
import { buttonClasses } from '@/components/ui/lq/Button';
import { BrandMark } from '@/components/layout/Brand';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { Frame, Pedestal, Plaque, Room, TourLine } from '@/components/about/Museum';
import { Lettering } from '@/components/layout/Lettering';
import { useLocale, type Copy } from '@/lib/i18n';

const CREATOR = { name: 'Miguel Angel Romero', initials: 'MR', instagram: 'miguxlxr' };

const COPY: Copy<{
  tagline: string; about: string; logoAlt: string; roomOrigin: string; roomPurpose: string; roomAuthor: string; roomHistory: string; roomExit: string;
  whyTitle: string; whyP1: string; whyP2: string; purposeTitle: string;
  pillars: Array<{ title: string; text: string }>;
  whoTitle: string; authorP: string; authorWho: string; igSr: string;
  historyTitle: string; historyBody: string; milestone: (n: number) => string; pending: string;
  exitThanks: string; backToDay: string; help: string; copyright: (y: number, name: string) => string;
}> = {
  es: {
    tagline: 'Orden en calma para tu rutina, tu mente y tus ideas.', about: 'Acerca de', logoAlt: 'Logo de Noutlife',
    roomOrigin: 'El origen', roomPurpose: 'El propósito', roomAuthor: 'El autor', roomHistory: 'La historia', roomExit: 'Salida',
    whyTitle: 'Mejorar es fácil de empezar y difícil de sostener.',
    whyP1: 'Todos hemos empezado un hábito con ganas y lo hemos dejado a las dos semanas. Casi siempre lo que falta es un lugar tranquilo donde ver con claridad qué hiciste, qué sigue y por qué importa.',
    whyP2: 'Noutlife reúne tu rutina, tu mente y tus ideas en un solo espacio en calma: metas claras, progreso visible y nada de ruido, para que volver cada día se sienta ligero.',
    purposeTitle: 'Ayudarte a construir tu mejor versión, un día a la vez.',
    pillars: [
      { title: 'Calma antes que ruido', text: 'Un diseño limpio y pocas decisiones por pantalla: abres, registras lo de hoy y sigues con tu día con la mente más clara.' },
      { title: 'Constancia antes que perfección', text: 'Las rachas, los rituales y los pequeños logros premian volver cada día, aunque sea un poco. El progreso se construye así.' },
      { title: 'Toda tu vida en un lugar', text: 'Ver tus zonas juntas te ayuda a notar qué va bien, qué se está quedando atrás y dónde poner la energía esta semana.' },
      { title: 'Tus datos son tuyos', text: 'Puedes exportar todo lo que registras o borrarlo cuando quieras desde Ajustes.' },
    ],
    whoTitle: 'Quién lo hace',
    authorP: 'Noutlife es un proyecto independiente, diseñado y desarrollado por una sola persona que quería una forma más motivadora de cuidar sus hábitos, su dinero, su cuerpo y su mente. Cada pantalla está hecha con la misma idea: que avanzar se sienta bien.',
    authorWho: 'Quién lo hace',
    igSr: ' (Instagram, se abre en otra pestaña)',
    historyTitle: 'La historia del proyecto',
    historyBody: 'Esta sala espera los hitos del proyecto: sus primeros pasos, sus versiones y los momentos clave.',
    milestone: (n) => `Hito ${n}`, pending: 'Pendiente de contenido: fecha y descripción.',
    exitThanks: 'Gracias por estar aquí. Cada día que vuelves, tu rutina se ordena un poco más.',
    backToDay: 'Volver a mi día', help: 'Ayuda',
    copyright: (y, name) => `© ${y} Noutlife · ${name}`,
  },
  en: {
    tagline: 'Calm order for your routine, your mind and your ideas.', about: 'About', logoAlt: 'NoutLife logo',
    roomOrigin: 'The origin', roomPurpose: 'The purpose', roomAuthor: 'The author', roomHistory: 'The story', roomExit: 'Exit',
    whyTitle: 'Getting better is easy to start and hard to sustain.',
    whyP1: 'We have all started a habit with real motivation and dropped it two weeks later. Most of the time what is missing is a calm place to see clearly what you did, what comes next and why it matters.',
    whyP2: 'NoutLife brings your routine, your mind and your ideas together in one calm space: clear goals, visible progress and no noise, so coming back every day feels light.',
    purposeTitle: 'Helping you build your best version, one day at a time.',
    pillars: [
      { title: 'Calm before noise', text: 'A clean design and few decisions per screen: you open the app, log today, and get back to your day with a clearer mind.' },
      { title: 'Consistency before perfection', text: 'Streaks, rituals and small wins reward coming back every day, even if only a little. That is how progress is built.' },
      { title: 'All of your life in one place', text: 'Seeing your zones together helps you notice what is going well, what is falling behind and where to put your energy this week.' },
      { title: 'Your data is yours', text: 'You can export everything you log, or delete it whenever you want from Settings.' },
    ],
    whoTitle: 'Who makes it',
    authorP: 'NoutLife is an independent project, designed and built by one person who wanted a more motivating way to look after their habits, money, body and mind. Every screen is made with the same idea: that moving forward should feel good.',
    authorWho: 'Who makes it',
    igSr: ' (Instagram, opens in a new tab)',
    historyTitle: 'The story of the project',
    historyBody: 'This room is waiting for the project’s milestones: its first steps, its versions and its key moments.',
    milestone: (n) => `Milestone ${n}`, pending: 'Content pending: date and description.',
    exitThanks: 'Thanks for being here. Every day you come back, your routine gets a little more in order.',
    backToDay: 'Back to my day', help: 'Help',
    copyright: (y, name) => `© ${y} NoutLife · ${name}`,
  },
};

const PILLAR_STYLE = [
  { icon: Leaf, tone: 'bg-primary/[var(--lq-soft-alpha)] text-primary-text' },
  { icon: Target, tone: 'bg-warning/[var(--lq-soft-alpha)] text-warning-text' },
  { icon: Compass, tone: 'bg-info/[var(--lq-soft-alpha)] text-info-text' },
  { icon: ShieldCheck, tone: 'bg-success/[var(--lq-soft-alpha)] text-success-text' },
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
  const locale = useLocale();
  const t = COPY[locale];
  const words = t.tagline.split(' ');
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
            <BrandMark tile alt={t.logoAlt} className="animate-float [.reduce-motion_&]:animate-none size-24 rounded-[28px] shadow-lg md:size-28" />
          </motion.span>
        </Pedestal>
        <div className="flex flex-col items-center gap-4">
          <span className="text-label-lg text-primary-text">{t.about}</span>
          <h1 id="about-title" className="text-display-md md:text-display-lg"><Lettering text="Noutlife" /></h1>
          <p className="max-w-xl text-heading-sm font-medium text-on-surface md:text-heading-md" aria-label={t.tagline}>
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
        <Room n={1} label={t.roomOrigin} id="about-why">
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-12">
            <div className="flex flex-col gap-4">
              <h2 id="about-why" className="text-heading-lg md:text-display-sm">{t.whyTitle}</h2>
              <div className="flex flex-col gap-4 text-body-lg text-on-surface">
                <p>{t.whyP1}</p>
                <p>{t.whyP2}</p>
              </div>
            </div>
            <Frame className="aspect-[4/3]"><OriginPainting /></Frame>
          </div>
        </Room>

        {/* Sala 2: el propósito, cuatro cuadros con su placa */}
        <Room n={2} label={t.roomPurpose} id="about-purpose">
          <h2 id="about-purpose" className="max-w-2xl text-heading-lg md:text-display-sm">{t.purposeTitle}</h2>
          <ul className="grid gap-10 sm:grid-cols-2">
            {t.pillars.map((p, i) => {
              const style = PILLAR_STYLE[i];
              const Icon = style.icon;
              return (
                <motion.li
                  key={p.title}
                  className="group flex flex-col gap-4"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ ...springSoft, delay: i * 0.08 }}
                >
                  <Frame kind={i % 2 ? 'wood' : 'gold'} className="aspect-[5/3] transition-transform duration-[900ms] ease-[var(--lq-ease-heavy)] group-hover:-translate-y-1">
                    <span aria-hidden="true" className={cn('flex size-full items-center justify-center', style.tone)}>
                      <Icon className="size-14 transition-transform duration-[900ms] ease-[var(--lq-ease-heavy)] group-hover:scale-110" strokeWidth={1.25} />
                    </span>
                  </Frame>
                  <Plaque title={p.title}><p>{p.text}</p></Plaque>
                </motion.li>
              );
            })}
          </ul>
        </Room>

        {/* Sala 3: el autor, su retrato */}
        <Room n={3} label={t.roomAuthor} id="about-author">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-12">
            <Frame kind="wood" className="aspect-[4/5] w-48 shrink-0 md:w-56">
              <span aria-hidden="true" className="flex size-full items-center justify-center bg-primary-strong text-display-sm font-bold text-on-primary">{CREATOR.initials}</span>
            </Frame>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <Plaque title={CREATOR.name} as="h2" className="self-start">
                <p id="about-author">{t.authorWho}</p>
              </Plaque>
              <p className="text-body-lg text-on-surface">{t.authorP}</p>
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
                <span className="sr-only">{t.igSr}</span>
              </motion.a>
            </div>
          </div>
        </Room>

        {/* Sala 4: la historia del proyecto (sin contenido todavía: no se inventa) */}
        <Room n={4} label={t.roomHistory} id="about-history">
          <h2 id="about-history" className="text-heading-lg md:text-display-sm">{t.historyTitle}</h2>
          <p className="max-w-2xl text-body-lg text-on-surface">{t.historyBody}</p>
          <ul className="grid gap-4 sm:grid-cols-3">
            {MILESTONES.map((m) => (
              <li key={m} className="lq-pending-exhibit flex flex-col gap-1 p-5 text-center">
                <span className="font-mono text-label-md text-on-surface">{t.milestone(m)}</span>
                <span className="text-body-sm text-on-surface">{t.pending}</span>
              </li>
            ))}
          </ul>
        </Room>

        {/* Sala 5: la salida */}
        <Room n={5} label={t.roomExit} id="about-exit" className="items-center">
          <div className="flex flex-col items-center gap-5 text-center">
            <Sparkles aria-hidden className="size-6 text-primary-text" strokeWidth={1.75} />
            <h2 id="about-exit" className="sr-only">{t.roomExit}</h2>
            <p className="max-w-lg text-body-lg text-on-surface">{t.exitThanks}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/" className={buttonClasses('primary', 'md')}><HeartHandshake aria-hidden className="size-5" strokeWidth={1.75} />{t.backToDay}</Link>
              <Link to="/faq" className={buttonClasses('ghost', 'md')}><LifeBuoy aria-hidden className="size-5" strokeWidth={1.75} />{t.help}</Link>
            </div>
            <span className="flex items-center gap-2 text-body-sm text-on-surface-light">
              <BrandMark size={24} />
              {t.copyright(new Date().getFullYear(), CREATOR.name)}
            </span>
          </div>
        </Room>
      </TourLine>
    </ZoneShell>
  );
}
