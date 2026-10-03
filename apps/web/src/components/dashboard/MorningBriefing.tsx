// Briefing del día — saludo, fecha, tres cifras del día (hábitos, misiones,
// racha) y el mensaje del Sabio (/life/morning-briefing). Modal en md+, hoja en
// móvil (ResponsiveDialog). Entrada en cascada de 50 ms.
import { Fragment, useEffect, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { CheckCircle2, Flag, Flame, Sparkles, type LucideIcon } from 'lucide-react';
import { ease } from '@/lib/motion';
import { fetchMorningBriefing } from '@/services/lifescore.service';
import { Button, IconChip, ResponsiveDialog, Skeleton, type Tone } from '@/components/ui/lq';

const FALLBACK = '**Enfoque hoy:** mantén tus misiones al día.\n**Consejo:** avanza con constancia y cuida tus rachas.';

const list: Variants = { animate: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } };
const child: Variants = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease } } };

interface Props {
  open: boolean;
  onClose: () => void;
  name: string;
  habitsDone: number;
  habitsTotal: number;
  quests: number;
  streak: number;
}

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

/** **negrita** → <b>; respeta saltos de línea. */
function Rich({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-line text-body-md text-on-surface">
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i} className="text-on-background">{part}</b> : <Fragment key={i}>{part}</Fragment>))}
    </p>
  );
}

function Figure({ icon, tone, value, label }: { icon: LucideIcon; tone: Tone; value: string; label: string }) {
  return (
    <motion.li variants={child} className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-3 md:p-4">
      <IconChip icon={icon} tone={tone} size="sm" />
      <span className="text-heading-md tabular-nums">{value}</span>
      <span className="text-body-sm text-on-surface-light">{label}</span>
    </motion.li>
  );
}

export function MorningBriefing({ open, onClose, name, habitsDone, habitsTotal, quests, streak }: Props) {
  const [briefing, setBriefing] = useState<string | null>(null);

  useEffect(() => {
    if (!open || briefing) return;
    fetchMorningBriefing().then((d) => setBriefing(d.briefing?.trim() || FALLBACK)).catch(() => setBriefing(FALLBACK));
  }, [open, briefing]);

  const date = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={<span className="block text-heading-lg md:text-display-sm">{greeting()}, {name}</span>}
      className="md:max-w-[520px]"
    >
      <motion.div variants={list} initial="initial" animate="animate" className="flex flex-col gap-6">
        <motion.p variants={child} className="-mt-3 text-body-sm text-on-surface-light first-letter:uppercase">{date}</motion.p>

        <motion.ul variants={list} aria-label="Tu día en cifras" className="grid grid-cols-3 gap-2 md:gap-3">
          <Figure icon={CheckCircle2} tone="success" value={`${habitsDone}/${habitsTotal}`} label="Hábitos hoy" />
          <Figure icon={Flag} tone="primary" value={String(quests)} label={quests === 1 ? 'Misión activa' : 'Misiones activas'} />
          <Figure icon={Flame} tone="warning" value={String(streak)} label={streak === 1 ? 'Día de racha' : 'Días de racha'} />
        </motion.ul>

        <motion.section variants={child} aria-labelledby="briefing-sage" className="flex flex-col gap-3 rounded-2xl bg-secondary/[var(--lq-soft-alpha)] p-4">
          <h3 id="briefing-sage" className="flex items-center gap-2 text-label-lg text-secondary-text">
            <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
            Mensaje del Sabio
          </h3>
          {briefing ? (
            <Rich text={briefing} />
          ) : (
            <div aria-busy="true" aria-label="Cargando mensaje" className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
        </motion.section>

        <motion.div variants={child}>
          <Button size="lg" block onClick={onClose} data-autofocus>Comenzar el día</Button>
        </motion.div>
      </motion.div>
    </ResponsiveDialog>
  );
}
