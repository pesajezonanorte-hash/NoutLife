// Ayuda (HelpDesktop): búsqueda en vivo sin tildes + chips de categoría,
// acordeones con aria-expanded y «¿Te sirvió?», estado sin resultados y 3 tarjetas de contacto.
// Zona ambientada: un mostrador de información. Un cartel «i» cuelga y se mece; el
// buscador está sobre el mostrador y su timbre suena al buscar; las categorías son
// placas de señalética; cada pregunta es una ficha del exhibidor que se saca al
// abrirla. Al encontrar la respuesta, su ficha se resalta con calma y lo buscado
// queda marcado en el texto. Las tarjetas de contacto son ventanillas.
import { useMemo, useRef, useState } from 'react';
import { ZoneShell } from '@/components/ambience';
import { DeskBell, Highlight, InfoSign } from '@/components/help/HelpDesk';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, MessageCircle, Search, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp, Trophy, Zap, type LucideIcon } from 'lucide-react';
import { item, pop3, stagger } from '@/lib/motion';
import { useUIStore } from '@/store/uiStore';
import { useShellStore } from '@/store/shellStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { AccordionItem, Button, ChipGroup, EmptyState, IconChip, SpotCard, type ChipOption, type Tone } from '@/components/ui/lq';

type CatId = 'start' | 'game' | 'sabio' | 'account';
const CATS: Record<CatId, { label: string; tone: Exclude<Tone, 'muted'>; icon: LucideIcon }> = {
  start: { label: 'Primeros pasos', tone: 'primary', icon: Zap },
  game: { label: 'Juego y XP', tone: 'warning', icon: Trophy },
  sabio: { label: 'El Sabio', tone: 'forest', icon: Sparkles },
  account: { label: 'Cuenta y datos', tone: 'success', icon: ShieldCheck },
};

const FAQ: Array<{ cat: CatId; q: string; a: string; privacy?: boolean }> = [
  { cat: 'start', q: '¿Qué es Noutlife?', a: 'Un RPG para tu vida real. Conviertes metas, hábitos, entrenamientos, finanzas y aprendizaje en misiones: ganas XP, subes de nivel y desbloqueas logros según lo que haces de verdad.' },
  { cat: 'game', q: '¿Cómo funcionan las misiones?', a: 'Las misiones son objetivos más grandes que un hábito, con dificultad, fecha límite y pasos. Al completar el último paso puedes cerrarlas y recibir su XP y oro. Las acciones recurrentes se crean como hábitos.' },
  { cat: 'game', q: '¿Cómo se calculan el XP y los niveles?', a: 'Cada acción registrada suma XP: hábitos, misiones, entrenamientos, sueño, entradas del diario y más. Cada nivel pide algo más de XP que el anterior; tu barra de nivel muestra cuánto falta.' },
  { cat: 'game', q: '¿Qué son los hábitos y las rachas?', a: 'Un hábito es una acción recurrente. La racha cuenta los días seguidos que lo completas; si fallas un día se reinicia, salvo que uses un Pase de perdón de la Tienda.' },
  { cat: 'sabio', q: '¿Quién es el Sabio?', a: 'Es el asistente con IA de Noutlife. Te sugiere rutinas y misiones, crea zonas personalizadas, analiza tus hábitos y responde preguntas sobre tu progreso. Recuerda tus conversaciones anteriores.' },
  { cat: 'account', q: '¿Mis datos están seguros?', a: 'Tus registros son privados y solo tú los ves, salvo lo que decidas compartir con amigos o tu gremio. Las contraseñas se guardan cifradas y las sesiones caducan.', privacy: true },
  { cat: 'account', q: '¿Qué ven mis amigos en mi perfil?', a: 'Tu nombre, nivel, logros desbloqueados, rachas y posición en el ranking. Tus finanzas, diario y datos de salud nunca se muestran.' },
  { cat: 'sabio', q: '¿Puedo usar Noutlife sin Spotify o sin la IA?', a: 'Sí. Spotify, Google Calendar y el Sabio son opcionales; todo el núcleo funciona sin ellos y puedes desactivar las sugerencias en Ajustes.' },
  { cat: 'start', q: '¿Funciona en el celular?', a: 'Sí. La interfaz se adapta a cualquier pantalla desde 375 px, con barra inferior y botón de acción rápida en móvil, y puedes instalarla como app desde el navegador.' },
  { cat: 'start', q: '¿Cómo reporto un error o sugiero algo?', a: 'Usa «Enviar feedback» arriba o la tarjeta «Reportar un problema» al final de esta página. Tu mensaje llega directo al equipo.' },
];

/** Minúsculas y sin tildes: «sueno» encuentra «sueño». */
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function FAQPage() {
  const openSage = useUIStore((s) => s.openSage);
  const openFeedback = useShellStore((s) => s.setFeedbackOpen);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | CatId>('all');
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  const [vote, setVote] = useState<Record<number, 'y' | 'n'>>({});
  /** El timbre suena al empezar a buscar y al pulsar Enter. */
  const [ring, setRing] = useState(0);
  const wasEmpty = useRef(true);
  const onSearch = (v: string) => {
    if (wasEmpty.current && v.trim()) setRing((r) => r + 1);
    wasEmpty.current = !v.trim();
    setQ(v);
  };

  const query = norm(q.trim());
  const list = useMemo(
    () => FAQ.map((f, i) => ({ f, i })).filter(({ f }) => (cat === 'all' || f.cat === cat) && (!query || norm(`${f.q} ${f.a}`).includes(query))),
    [cat, query],
  );
  const options: ChipOption<'all' | CatId>[] = [{ value: 'all', label: 'Todo' }, ...(Object.keys(CATS) as CatId[]).map((id) => ({ value: id, label: CATS[id].label, icon: CATS[id].icon }))];
  const found = Boolean(query) && list.length <= 2;

  return (
    <ZoneShell
      zone="faq"
      className="lq-helpdesk mx-auto w-full max-w-[960px]"
      contentClassName="gap-8 md:gap-12"
      ambience={<InfoSign className="absolute right-[6%] top-[-1.5rem] hidden h-28 w-28 md:block" />}
    >
      <PageHeader
        eyebrow="Ayuda y preguntas"
        title="¿En qué te ayudamos?"
        description="Todo lo que necesitas saber para empezar tu aventura."
        aside={<Button variant="secondary" size="md" onClick={() => openFeedback(true)}><MessageCircle aria-hidden className="size-4" strokeWidth={1.75} />Enviar feedback</Button>}
      />

      <motion.section variants={item} className="lq-counter relative flex flex-col gap-4 rounded-2xl p-5 md:p-6" aria-label="Buscar en la ayuda">
        {/* El timbre del mostrador */}
        <DeskBell ring={ring} className="absolute -top-6 right-6 h-10 w-12" />
        <div className="relative">
          <label htmlFor="help-q" className="sr-only">Buscar en la ayuda</label>
          <Search aria-hidden className="pointer-events-none absolute left-[18px] top-4 size-6 text-on-surface-light" strokeWidth={1.75} />
          <input
            id="help-q" type="search" value={q} onChange={(e) => onSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setRing((r) => r + 1)}
            placeholder="Busca: XP, rachas, Sabio, datos…"
            className="min-h-14 w-full rounded-2xl border border-border-strong bg-background pl-[52px] pr-4 text-[1.0625rem] text-on-background transition-[border-color,box-shadow] placeholder:text-on-surface-light hover:border-on-surface-light focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/25"
          />
        </div>
        <ChipGroup label="Categoría" options={options} value={cat} onChange={setCat} />
      </motion.section>

      <motion.section variants={item} className="flex flex-col gap-3" aria-label="Preguntas frecuentes">
        <p aria-live="polite" className="text-body-sm text-on-surface-light">
          {query ? `${list.length} ${list.length === 1 ? 'resultado' : 'resultados'}` : `${list.length} preguntas frecuentes`}
        </p>
        {list.length === 0 ? (
          <motion.div variants={pop3} initial="initial" animate="animate">
            <EmptyState
              icon={Search} tone="muted"
              title={`Sin resultados para “${q.trim()}”`}
              description="Prueba con otra palabra o pregúntale directamente al Sabio."
              action={<div className="flex flex-wrap justify-center gap-3">
                <Button variant="secondary" onClick={() => { setQ(''); setCat('all'); }}>Limpiar búsqueda</Button>
                <Button onClick={() => openSage(q.trim())}><Sparkles aria-hidden className="size-4" strokeWidth={1.75} />Preguntar al Sabio</Button>
              </div>}
            />
          </motion.div>
        ) : (
          <motion.div key={`${cat}-${query}`} variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-3">
            {list.map(({ f, i }) => {
              const c = CATS[f.cat];
              // Con 1–2 resultados de búsqueda se abren solos.
              const isOpen = Boolean(open[i]) || (Boolean(query) && list.length <= 2);
              const v = vote[i];
              return (
                // La ficha sale del exhibidor al abrirla; la respuesta encontrada se resalta con calma
                <motion.div key={i} variants={item} data-open={isOpen} className={cn('lq-slot rounded-2xl', found && 'lq-found')}>
                  <AccordionItem
                    title={f.q}
                    open={isOpen}
                    onToggle={() => setOpen((o) => ({ ...o, [i]: !isOpen }))}
                    leading={<IconChip icon={c.icon} tone={c.tone} size="sm" className="size-9 rounded-[10px] [&>svg]:size-4" />}
                  >
                    <div className="flex flex-col gap-3.5 px-4 pb-5 md:pl-[72px] md:pr-5">
                      <p className="text-body-md text-on-surface">
                        {query ? <Highlight text={f.a} query={q} /> : f.a}
                        {/* TODO: enlazar la política de privacidad vigente cuando exista su página. */}
                        {f.privacy && <> Consulta <Link to="/about" className="font-semibold text-primary-text underline-offset-4 hover:underline">Acerca de</Link> para el detalle.</>}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-body-sm text-on-surface-light">¿Te sirvió?</span>
                        <Button size="sm" variant={v === 'y' ? 'primary' : 'secondary'} aria-pressed={v === 'y'} onClick={() => setVote((x) => ({ ...x, [i]: 'y' }))}>
                          <ThumbsUp aria-hidden className="size-4" strokeWidth={1.75} />Sí
                        </Button>
                        <Button size="sm" variant={v === 'n' ? 'primary' : 'secondary'} aria-pressed={v === 'n'} onClick={() => setVote((x) => ({ ...x, [i]: 'n' }))}>
                          <ThumbsDown aria-hidden className="size-4" strokeWidth={1.75} />No
                        </Button>
                        {v && (
                          <motion.span variants={pop3} initial="initial" animate="animate" className="flex items-center gap-1 text-body-sm text-success-text">
                            <Check aria-hidden className="size-4" strokeWidth={2} />Gracias
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </AccordionItem>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.section>

      <motion.section variants={item} aria-label="Más ayuda" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: Sparkles, tone: 'primary' as const, title: 'Pregúntale al Sabio', body: 'Respuestas al instante sobre tu progreso.', onClick: () => openSage('Tengo una duda sobre Noutlife: ') },
          { icon: MessageCircle, tone: 'warning' as const, title: 'Reportar un problema', body: 'Cuéntanos qué pasó y lo revisamos.', onClick: () => openFeedback(true) },
          { icon: ShieldCheck, tone: 'success' as const, title: 'Privacidad', body: 'Cómo tratamos tus datos.', to: '/about' },
        ].map((card, idx) => {
          const inner = (
            <>
              {/* El letrero de la ventanilla */}
              <span aria-hidden="true" className="lq-window-sign -mx-4 -mt-4 mb-1 block rounded-t-2xl px-4 py-1.5 font-mono text-label-md md:-mx-6 md:-mt-6 md:px-6">Ventanilla {idx + 1}</span>
              <IconChip icon={card.icon} tone={card.tone} />
              <span className="text-heading-sm">{card.title}</span>
              <span className="text-body-sm text-on-surface-light">{card.body}</span>
            </>
          );
          return card.to ? (
            <SpotCard key={card.title} as={Link} to={card.to} padding="md" className="flex flex-col gap-2.5 text-on-background">{inner}</SpotCard>
          ) : (
            <SpotCard key={card.title} as="button" type="button" onClick={card.onClick} padding="md" className="flex flex-col items-start gap-2.5 text-left text-on-background">{inner}</SpotCard>
          );
        })}
      </motion.section>
    </ZoneShell>
  );
}
