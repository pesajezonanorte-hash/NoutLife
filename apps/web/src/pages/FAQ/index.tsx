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
import { useText, type Copy } from '@/lib/i18n';

type CatId = 'start' | 'game' | 'sabio' | 'account';

const COPY: Copy<{
  eyebrow: string; title: string; intro: string; feedback: string; searchAria: string; searchLabel: string; searchPh: string;
  category: string; all: string; results: (n: number) => string; questions: (n: number) => string; moreHelp: string;
  noResults: (q: string) => string; noResultsBody: string; clear: string; askSage: string;
  helpful: string; yes: string; no: string; thanks: string; privacyLink: string; privacyLead: string; privacyLead2: string;
  cats: Record<CatId, string>;
  cards: { sage: { title: string; body: string }; report: { title: string; body: string }; privacy: { title: string; body: string } };
  window: (n: number) => string; sageDraft: string; reportPh: string;
  faq: Array<{ cat: CatId; q: string; a: string; privacy?: boolean }>;
}> = {
  es: {
    eyebrow: 'Ayuda y preguntas', title: '¿En qué te ayudamos?', intro: 'Todo lo que necesitas saber para empezar tu aventura.',
    feedback: 'Enviar feedback', searchAria: 'Buscar en la ayuda', searchLabel: 'Buscar en la ayuda',
    searchPh: 'Busca: XP, rachas, Sabio, datos…', category: 'Categoría', all: 'Todo',
    results: (n) => `${n} ${n === 1 ? 'resultado' : 'resultados'}`, questions: (n) => `${n} preguntas frecuentes`,
    moreHelp: 'Más ayuda', noResults: (q) => `Sin resultados para “${q}”`,
    noResultsBody: 'Prueba con otra palabra o pregúntale directamente al Sabio.', clear: 'Limpiar búsqueda',
    askSage: 'Preguntar al Sabio', helpful: '¿Te sirvió?', yes: 'Sí', no: 'No', thanks: 'Gracias',
    privacyLink: 'Acerca de', privacyLead: 'Consulta', privacyLead2: 'para el detalle.',
    cats: { start: 'Primeros pasos', game: 'Juego y XP', sabio: 'El Sabio', account: 'Cuenta y datos' },
    cards: {
      sage: { title: 'Pregúntale al Sabio', body: 'Respuestas al instante sobre tu progreso.' },
      report: { title: 'Reportar un problema', body: 'Cuéntanos qué pasó y lo revisamos.' },
      privacy: { title: 'Privacidad', body: 'Cómo tratamos tus datos.' },
    },
    window: (n) => `Ventanilla ${n}`, sageDraft: 'Tengo una duda sobre Noutlife: ', reportPh: '',
    faq: [
      { cat: 'start', q: '¿Qué es Noutlife?', a: 'Tu rutina, tu mente y tus ideas en un solo lugar: hábitos, libreta, obstáculos, bienestar y metas en un espacio en calma. Las rachas, los logros y tu personaje te acompañan mientras avanzas.' },
      { cat: 'game', q: '¿Cómo funcionan las misiones?', a: 'Las misiones son objetivos más grandes que un hábito, con dificultad, fecha límite y pasos. Al completar el último paso puedes cerrarlas y recibir su XP y oro. Las acciones recurrentes se crean como hábitos.' },
      { cat: 'game', q: '¿Cómo se calculan el XP y los niveles?', a: 'Cada acción registrada suma XP: hábitos, misiones, entrenamientos, sueño, entradas del diario y más. Cada nivel pide algo más de XP que el anterior; tu barra de nivel muestra cuánto falta.' },
      { cat: 'game', q: '¿Qué son los hábitos y las rachas?', a: 'Un hábito es una acción recurrente. La racha cuenta los días seguidos que lo completas; si fallas un día se reinicia, salvo que uses un Pase de perdón de la Tienda.' },
      { cat: 'sabio', q: '¿Quién es el Sabio?', a: 'Es el asistente con IA de Noutlife. Te sugiere rutinas y misiones, crea zonas personalizadas, analiza tus hábitos y responde preguntas sobre tu progreso. Recuerda tus conversaciones anteriores.' },
      { cat: 'account', q: '¿Mis datos están seguros?', a: 'Tus registros son privados y solo tú los ves, salvo lo que decidas compartir con amigos o tu gremio. Las contraseñas se guardan cifradas y las sesiones caducan.', privacy: true },
      { cat: 'account', q: '¿Qué ven mis amigos en mi perfil?', a: 'Tu nombre, nivel, logros desbloqueados, rachas y posición en el ranking. Tus finanzas, diario y datos de salud nunca se muestran.' },
      { cat: 'sabio', q: '¿Puedo usar Noutlife sin Spotify o sin la IA?', a: 'Sí. Spotify, Google Calendar y el Sabio son opcionales; todo el núcleo funciona sin ellos y puedes desactivar las sugerencias en Ajustes.' },
      { cat: 'start', q: '¿Funciona en el celular?', a: 'Sí. La interfaz se adapta a cualquier pantalla desde 375 px, con barra inferior y botón de acción rápida en móvil, y puedes instalarla como app desde el navegador.' },
      { cat: 'start', q: '¿Cómo reporto un error o sugiero algo?', a: 'Usa «Enviar feedback» arriba o la tarjeta «Reportar un problema» al final de esta página. Tu mensaje llega directo al equipo.' },
    ],
  },
  en: {
    eyebrow: 'Help & questions', title: 'How can we help?', intro: 'Everything you need to know to start your adventure.',
    feedback: 'Send feedback', searchAria: 'Search help', searchLabel: 'Search help',
    searchPh: 'Search: XP, streaks, Sage, data…', category: 'Category', all: 'All',
    results: (n) => `${n} ${n === 1 ? 'result' : 'results'}`, questions: (n) => `${n} frequently asked questions`,
    moreHelp: 'More help', noResults: (q) => `No results for “${q}”`,
    noResultsBody: 'Try another word or ask the Sage directly.', clear: 'Clear search',
    askSage: 'Ask the Sage', helpful: 'Was this helpful?', yes: 'Yes', no: 'No', thanks: 'Thanks',
    privacyLink: 'About', privacyLead: 'See', privacyLead2: 'for the details.',
    cats: { start: 'Getting started', game: 'Game & XP', sabio: 'The Sage', account: 'Account & data' },
    cards: {
      sage: { title: 'Ask the Sage', body: 'Instant answers about your progress.' },
      report: { title: 'Report a problem', body: 'Tell us what happened and we will look into it.' },
      privacy: { title: 'Privacy', body: 'How we handle your data.' },
    },
    window: (n) => `Window ${n}`, sageDraft: 'I have a question about NoutLife: ', reportPh: '',
    faq: [
      { cat: 'start', q: 'What is NoutLife?', a: 'Your routine, your mind and your ideas in one place: habits, notebook, obstacles, wellbeing and goals in a calm space. Streaks, achievements and your character keep you company as you move forward.' },
      { cat: 'game', q: 'How do goals work?', a: 'Goals are bigger than a habit, with a difficulty, a deadline and steps. When you complete the last step you can close them and receive their XP and gold. Recurring actions are created as habits.' },
      { cat: 'game', q: 'How are XP and levels calculated?', a: 'Every logged action adds XP: habits, goals, workouts, sleep, journal entries and more. Each level needs a bit more XP than the one before; your level bar shows how much is left.' },
      { cat: 'game', q: 'What are habits and streaks?', a: 'A habit is a recurring action. The streak counts the days in a row you complete it; if you miss a day it resets, unless you use a Grace Pass from the Shop.' },
      { cat: 'sabio', q: 'Who is the Sage?', a: 'It is NoutLife’s AI assistant. It suggests routines and goals, creates custom zones, analyzes your habits and answers questions about your progress. It remembers your earlier conversations.' },
      { cat: 'account', q: 'Is my data safe?', a: 'Your records are private and only you see them, except what you decide to share with friends or your guild. Passwords are stored encrypted and sessions expire.', privacy: true },
      { cat: 'account', q: 'What do my friends see on my profile?', a: 'Your name, level, unlocked achievements, streaks and ranking position. Your finances, journal and health data are never shown.' },
      { cat: 'sabio', q: 'Can I use NoutLife without Spotify or the AI?', a: 'Yes. Spotify, Google Calendar and the Sage are optional; the whole core works without them, and you can turn the suggestions off in Settings.' },
      { cat: 'start', q: 'Does it work on my phone?', a: 'Yes. The interface adapts to any screen from 375 px, with a bottom bar and a quick-action button on mobile, and you can install it as an app from your browser.' },
      { cat: 'start', q: 'How do I report a bug or suggest something?', a: 'Use “Send feedback” at the top or the “Report a problem” card at the bottom of this page. Your message goes straight to the team.' },
    ],
  },
};

/** Minúsculas y sin tildes: «sueno» encuentra «sueño». */
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const CAT_ICON: Record<CatId, { tone: Exclude<Tone, 'muted'>; icon: LucideIcon }> = {
  start: { tone: 'primary', icon: Zap },
  game: { tone: 'warning', icon: Trophy },
  sabio: { tone: 'forest', icon: Sparkles },
  account: { tone: 'success', icon: ShieldCheck },
};
const CAT_IDS: CatId[] = ['start', 'game', 'sabio', 'account'];

export default function FAQPage() {
  const t = useText(COPY);
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
    () => t.faq.map((f, i) => ({ f, i })).filter(({ f }) => (cat === 'all' || f.cat === cat) && (!query || norm(`${f.q} ${f.a}`).includes(query))),
    [cat, query, t],
  );
  const options: ChipOption<'all' | CatId>[] = [{ value: 'all', label: t.all }, ...CAT_IDS.map((id) => ({ value: id, label: t.cats[id], icon: CAT_ICON[id].icon }))];
  const found = Boolean(query) && list.length <= 2;
  const cards: Array<{ icon: LucideIcon; tone: Exclude<Tone, 'muted'>; title: string; body: string; onClick?: () => void; to?: string }> = [
    { icon: Sparkles, tone: 'primary', ...t.cards.sage, onClick: () => openSage(t.sageDraft) },
    { icon: MessageCircle, tone: 'warning', ...t.cards.report, onClick: () => openFeedback(true) },
    { icon: ShieldCheck, tone: 'success', ...t.cards.privacy, to: '/about' },
  ];

  return (
    <ZoneShell
      zone="faq"
      className="lq-helpdesk mx-auto w-full max-w-[960px]"
      contentClassName="gap-8 md:gap-12"
      ambience={<InfoSign className="absolute right-[6%] top-[-1.5rem] hidden h-28 w-28 md:block" />}
    >
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.intro}
        aside={<Button variant="secondary" size="md" onClick={() => openFeedback(true)}><MessageCircle aria-hidden className="size-4" strokeWidth={1.75} />{t.feedback}</Button>}
      />

      <motion.section variants={item} className="lq-counter relative flex flex-col gap-4 rounded-2xl p-5 md:p-6" aria-label={t.searchAria}>
        {/* El timbre del mostrador */}
        <DeskBell ring={ring} className="absolute -top-6 right-6 h-10 w-12" />
        <div className="relative">
          <label htmlFor="help-q" className="sr-only">{t.searchLabel}</label>
          <Search aria-hidden className="pointer-events-none absolute left-[18px] top-4 size-6 text-on-surface-light" strokeWidth={1.75} />
          <input
            id="help-q" type="search" value={q} onChange={(e) => onSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setRing((r) => r + 1)}
            placeholder={t.searchPh}
            className="min-h-14 w-full rounded-2xl border border-border-strong bg-background pl-[52px] pr-4 text-[1.0625rem] text-on-background transition-[border-color,box-shadow] placeholder:text-on-surface-light hover:border-on-surface-light focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/25"
          />
        </div>
        <ChipGroup label={t.category} options={options} value={cat} onChange={setCat} />
      </motion.section>

      <motion.section variants={item} className="flex flex-col gap-3" aria-label={t.moreHelp}>
        <p aria-live="polite" className="text-body-sm text-on-surface-light">
          {query ? t.results(list.length) : t.questions(list.length)}
        </p>
        {list.length === 0 ? (
          <motion.div variants={pop3} initial="initial" animate="animate">
            <EmptyState
              icon={Search} tone="muted"
              title={t.noResults(q.trim())}
              description={t.noResultsBody}
              action={<div className="flex flex-wrap justify-center gap-3">
                <Button variant="secondary" onClick={() => { setQ(''); setCat('all'); }}>{t.clear}</Button>
                <Button onClick={() => openSage(q.trim())}><Sparkles aria-hidden className="size-4" strokeWidth={1.75} />{t.askSage}</Button>
              </div>}
            />
          </motion.div>
        ) : (
          <motion.div key={`${cat}-${query}`} variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-3">
            {list.map(({ f, i }) => {
              const c = CAT_ICON[f.cat];
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
                        {f.privacy && <> {t.privacyLead} <Link to="/about" className="font-semibold text-primary-text underline-offset-4 hover:underline">{t.privacyLink}</Link> {t.privacyLead2}</>}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-body-sm text-on-surface-light">{t.helpful}</span>
                        <Button size="sm" variant={v === 'y' ? 'primary' : 'secondary'} aria-pressed={v === 'y'} onClick={() => setVote((x) => ({ ...x, [i]: 'y' }))}>
                          <ThumbsUp aria-hidden className="size-4" strokeWidth={1.75} />{t.yes}
                        </Button>
                        <Button size="sm" variant={v === 'n' ? 'primary' : 'secondary'} aria-pressed={v === 'n'} onClick={() => setVote((x) => ({ ...x, [i]: 'n' }))}>
                          <ThumbsDown aria-hidden className="size-4" strokeWidth={1.75} />{t.no}
                        </Button>
                        {v && (
                          <motion.span variants={pop3} initial="initial" animate="animate" className="flex items-center gap-1 text-body-sm text-success-text">
                            <Check aria-hidden className="size-4" strokeWidth={2} />{t.thanks}
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

      <motion.section variants={item} aria-label={t.moreHelp} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card, idx) => {
          const inner = (
            <>
              {/* El letrero de la ventanilla */}
              <span aria-hidden="true" className="lq-window-sign -mx-4 -mt-4 mb-1 block rounded-t-2xl px-4 py-1.5 font-mono text-label-md md:-mx-6 md:-mt-6 md:px-6">{t.window(idx + 1)}</span>
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
