// El Sabio — consejero IA. Cajón a la derecha en md+ (el disparador vive en la
// Topbar, a la derecha), pantalla completa en móvil. Modal: foco atrapado,
// Escape cierra, el foco vuelve al disparador. Historial (8 últimos) en
// localStorage como antes; la conversación es un role="log".
import { Fragment, useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotionConfig, type Variants } from 'framer-motion';
import { BarChart2, Dumbbell, Send, Sparkles, Sword, Trash2, Wallet, X, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';
import { cn } from '@/lib/utils';
import { ease, scrim } from '@/lib/motion';
import {
  applySageAction, sageAnalyzeFinances, sageAnalyzeHabits, sageChat, sagePlanWorkout, sageRateInfo, sageSuggestQuests,
  type SageFinanceAction,
} from '@/services/sage.service';
import { useToastStore } from '@/hooks/useToast';
import { INTL_LOCALE, useLocale } from '@/lib/i18n';
import { useUIStore } from '@/store/uiStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button, IconChip, Input, useDialogBehavior } from '@/components/ui/lq';
import { useText, type Copy } from '@/lib/i18n';

const es = {
  title: 'El Sabio',
  tagline: 'Tu consejero IA',
  fallback: 'No pude responder ahora mismo. Inténtalo de nuevo en un momento.',
  actions: { quests: 'Ideas de misiones', habits: 'Analiza mis hábitos', finances: 'Revisa mis finanzas', coliseo: 'Plan de entrenamiento' },
  questsIntro: 'Te propongo estas misiones:',
  noQuests: 'No tengo sugerencias de misiones por ahora.',
  rateTip: 'Tus mensajes de hoy. El límite cambia según cuánta gente usa el Sabio: con menos gente, tienes más.',
  clear: 'Borrar conversación',
  close: 'Cerrar',
  askTitle: '¿En qué te ayudo hoy?',
  askBody: 'Pide ideas de misiones, analiza tus hábitos o tus finanzas, o pregunta lo que quieras.',
  todayMsgs: (n: number): string => `Hoy tienes ${n} mensajes. Cuanta menos gente usa el Sabio, más mensajes tienes.`,
  ofLimit: (n: number): string => `de ${n}`,
  log: 'Conversación con el Sabio',
  youPrefix: 'Tú: ',
  sagePrefix: 'El Sabio: ',
  thinking: 'El Sabio está pensando…',
  tiredLine: (n: number): string => `El Sabio se va cansando: te quedan ${n} ${n === 1 ? 'consulta' : 'consultas'} hoy.`,
  restUntilTomorrow: 'El Sabio descansa hasta mañana. Todo lo demás (hábitos, misiones, comidas, inicio) sigue funcionando con normalidad.',
  quickActions: 'Acciones rápidas',
  inputAria: 'Mensaje para el Sabio',
  returnTomorrow: 'El Sabio vuelve mañana…',
  typePlaceholder: 'Escribe tu pregunta…',
  send: 'Enviar',
  disclaimer: 'El Sabio puede equivocarse. Verifica las decisiones importantes.',
  proposalLabel: 'Propuesta para tus metas',
  goalFallback: 'una de tus metas',
  proposeCreate: (title: string, amount: string, date?: string) => `Crear la meta «${title}» por ${amount}${date ? `, para el ${date}` : ''}.`,
  proposeUpdate: (name: string, changes: string) => `Cambiar la meta «${name}»: ${changes}.`,
  proposeContribute: (name: string, amount: string) => `Aportar ${amount} a «${name}».`,
  changeAmount: (value: string) => `monto a ${value}`,
  changeDate: (value: string) => `fecha a ${value}`,
  clearDate: 'quitar la fecha',
  changeTitle: (value: string) => `título a «${value}»`,
  applyBtn: 'Aplicar',
  dismissBtn: 'No, gracias',
  actionDone: 'Cambio aplicado a tus metas.',
  actionFail: 'No se pudo aplicar el cambio. Revisa la meta e inténtalo otra vez.',
};

const en: typeof es = {
  title: 'The Sage',
  tagline: 'Your AI advisor',
  fallback: 'I could not answer right now. Please try again in a moment.',
  actions: { quests: 'Quest ideas', habits: 'Analyze my habits', finances: 'Review my finances', coliseo: 'Training plan' },
  questsIntro: 'Here are some quests for you:',
  noQuests: 'I have no quest suggestions for now.',
  rateTip: 'Your messages today. The limit changes with how many people use the Sage: the fewer people, the more messages you have.',
  clear: 'Clear conversation',
  close: 'Close',
  askTitle: 'How can I help you today?',
  askBody: 'Ask for quest ideas, analyze your habits or finances, or ask anything you like.',
  todayMsgs: (n: number): string => `Today you have ${n} messages. The fewer people use the Sage, the more messages you get.`,
  ofLimit: (n: number): string => `of ${n}`,
  log: 'Conversation with the Sage',
  youPrefix: 'You: ',
  sagePrefix: 'The Sage: ',
  thinking: 'The Sage is thinking…',
  tiredLine: (n: number): string => `The Sage is getting tired: you have ${n} ${n === 1 ? 'question' : 'questions'} left today.`,
  restUntilTomorrow: 'The Sage rests until tomorrow. Everything else (habits, quests, meals, home) keeps working as usual.',
  quickActions: 'Quick actions',
  inputAria: 'Message for the Sage',
  returnTomorrow: 'The Sage is back tomorrow…',
  typePlaceholder: 'Type your question…',
  send: 'Send',
  disclaimer: 'The Sage can make mistakes. Check important decisions.',
  proposalLabel: 'Proposal for your goals',
  goalFallback: 'one of your goals',
  proposeCreate: (title: string, amount: string, date?: string) => `Create the goal “${title}” for ${amount}${date ? `, by ${date}` : ''}.`,
  proposeUpdate: (name: string, changes: string) => `Change the goal “${name}”: ${changes}.`,
  proposeContribute: (name: string, amount: string) => `Add ${amount} to “${name}”.`,
  changeAmount: (value: string) => `amount to ${value}`,
  changeDate: (value: string) => `date to ${value}`,
  clearDate: 'remove the date',
  changeTitle: (value: string) => `title to “${value}”`,
  applyBtn: 'Apply',
  dismissBtn: 'No, thanks',
  actionDone: 'Change applied to your goals.',
  actionFail: "The change couldn't be applied. Check the goal and try again.",
};

const COPY: Copy<typeof es> = { es, en };

interface Message {
  from: 'user' | 'sage';
  text: string;
  /** Propuesta de cambio en metas (solo en respuestas del Sabio). */
  action?: SageFinanceAction;
  goalTitle?: string | null;
  actionState?: 'idle' | 'busy' | 'done' | 'dismissed';
}

type Action = 'quests' | 'habits' | 'finances' | 'coliseo';

const ACTIONS: Array<{ id: Action; icon: LucideIcon }> = [
  { id: 'quests', icon: Sword },
  { id: 'habits', icon: BarChart2 },
  { id: 'finances', icon: Wallet },
  { id: 'coliseo', icon: Dumbbell },
];

const STORAGE_KEY = 'sage-history';

const drawer: Variants = {
  initial: { x: '100%', opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.3, ease } },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.2 } },
};

function loadHistory(): Message[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(saved)
      ? saved.filter((m): m is Message => typeof m === 'object' && m !== null
        && ((m as Message).from === 'user' || (m as Message).from === 'sage') && typeof (m as Message).text === 'string')
      : [];
  } catch {
    return [];
  }
}

const clean = (reply: unknown, fallback: string) => (typeof reply === 'string' && reply.trim() ? reply : fallback);

/** Mensaje legible de un error de axios (`{ error, message }` del API), si existe. */
function extractApiError(err: unknown): string | null {
  if (typeof err !== 'object' || err === null || !('response' in err)) return null;
  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (typeof data !== 'object' || data === null) return null;
  const msg = (data as { message?: unknown }).message;
  return typeof msg === 'string' && msg.trim() ? msg : null;
}

/** Escritura progresiva de la última respuesta (visual); el texto completo va en sr-only. */
function Typewriter({ text }: { text: string }) {
  const reduce = useReducedMotionConfig();
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) { setN(text.length); return; }
    setN(0);
    const id = window.setInterval(() => setN((i) => {
      if (i >= text.length) { window.clearInterval(id); return i; }
      return i + 3;
    }), 16);
    return () => window.clearInterval(id);
  }, [text, reduce]);
  return (
    <>
      <span aria-hidden>{text.slice(0, n)}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}

/** Propuesta del Sabio para una meta: no cambia nada hasta que la persona la aplica. */
function GoalProposal({ action, goalTitle, state, onApply, onDismiss }: {
  action: SageFinanceAction;
  goalTitle?: string | null;
  state?: Message['actionState'];
  onApply: () => void;
  onDismiss: () => void;
}) {
  const t = useText(COPY);
  const locale = useLocale();
  if (state === 'dismissed') return null;

  const money = (n: number) => new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  const name = goalTitle ?? t.goalFallback;
  let description: string;
  if (action.action === 'create_goal') {
    description = t.proposeCreate(action.title, money(action.targetAmount), action.deadline);
  } else if (action.action === 'contribute_goal') {
    description = t.proposeContribute(name, money(action.amount));
  } else {
    const changes = [
      action.targetAmount !== undefined ? t.changeAmount(money(action.targetAmount)) : null,
      action.deadline !== undefined ? (action.deadline ? t.changeDate(action.deadline) : t.clearDate) : null,
      action.title !== undefined ? t.changeTitle(action.title) : null,
    ].filter(Boolean).join(', ');
    description = t.proposeUpdate(name, changes);
  }

  return (
    <div role="group" aria-label={t.proposalLabel} className="flex max-w-[85%] flex-col gap-3 self-start rounded-2xl border border-primary/30 bg-primary/[var(--lq-soft-alpha)] p-4">
      <p className="text-label-md text-primary-text">{t.proposalLabel}</p>
      <p className="text-body-md text-on-background">{description}</p>
      {state === 'done' ? (
        <p role="status" className="text-body-sm text-success-text">{t.actionDone}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={state === 'busy'} disabled={state === 'busy'} onClick={onApply}>{t.applyBtn}</Button>
          <Button size="sm" variant="ghost" disabled={state === 'busy'} onClick={onDismiss}>{t.dismissBtn}</Button>
        </div>
      )}
    </div>
  );
}

export function SagePanel({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const t = useText(COPY);
  const pending = useUIStore((s) => s.sagePendingMessage);
  const clearPending = useUIStore((s) => s.clearSagePending);
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [typing, setTyping] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // Cupo diario de consultas IA del usuario (el servidor lo reparte del nivel
  // gratuito de Groq/Gemini). Si es null, el endpoint falló y el panel sigue
  // funcionando sin contador.
  const [rate, setRate] = useState<{ remaining: number; limit: number; resetAt: string } | null>(null);
  // NoutLife Lite no tiene IA: el Sabio se cierra y se abre el diálogo de Pro, venga de donde venga.
  // La API también lo bloquea (402), así que un estado viejo aquí no abre nada.
  const lite = useAuthStore((s) => s.user?.subscription?.plan === 'lite');
  const openUpgrade = usePlanStore((s) => s.openUpgrade);
  useEffect(() => {
    if (!lite) return;
    onClose();
    openUpgrade('ai');
  }, [lite, onClose, openUpgrade]);
  const refreshRate = useCallback(async () => {
    try { setRate(await sageRateInfo()); } catch { /* sin contador */ }
  }, []);
  // El límite se reparte según la gente activa: se refresca mientras el panel está abierto.
  useEffect(() => {
    void refreshRate();
    const id = setInterval(() => void refreshRate(), 2 * 60_000);
    return () => clearInterval(id);
  }, [refreshRate]);
  const callsUsed = rate ? rate.limit - rate.remaining : null;
  const outOfCalls = rate !== null && rate.remaining <= 0;
  const panelRef = useDialogBehavior(true, onClose);
  const endRef = useRef<HTMLDivElement>(null);
  const sentPending = useRef(false);
  const reduce = useReducedMotionConfig();
  // En móvil no se enfoca el campo al abrir (abriría el teclado encima).
  const isDesktop = useMediaQuery('(min-width: 768px)');

  /** Pregunta al chat: además del texto, la respuesta puede traer una propuesta de cambio en metas. */
  async function askChat(userText: string) {
    setMessages((prev) => [...prev, { from: 'user', text: userText }]);
    setLoading(true);
    let reply = t.fallback;
    let proposal: Pick<Message, 'action' | 'goalTitle' | 'actionState'> = {};
    try {
      const res = await sageChat(userText);
      reply = clean(res.reply, t.fallback);
      if (res.action) proposal = { action: res.action, goalTitle: res.goalTitle ?? null, actionState: 'idle' };
    } catch (err) { reply = extractApiError(err) ?? t.fallback; }
    setMessages((prev) => {
      setTyping(prev.length);
      return [...prev, { from: 'sage', text: reply, ...proposal }];
    });
    setLoading(false);
    void refreshRate(); // cada respuesta consume cupo: refresca el contador
  }

  function setProposalState(index: number, state: NonNullable<Message['actionState']>) {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, actionState: state } : m)));
  }

  /** Confirmación explícita: el servidor vuelve a validar la propuesta antes de tocar la meta. */
  async function applyProposal(index: number, action: SageFinanceAction) {
    setProposalState(index, 'busy');
    try {
      await applySageAction(action);
      setProposalState(index, 'done');
      useToastStore.getState().success(t.actionDone);
    } catch (err) {
      setProposalState(index, 'idle');
      useToastStore.getState().error(extractApiError(err) ?? t.actionFail);
    }
  }

  async function ask(userText: string, request: () => Promise<string>) {
    setMessages((prev) => [...prev, { from: 'user', text: userText }]);
    setLoading(true);
    let reply = t.fallback;
    try { reply = clean(await request(), t.fallback); } catch (err) { reply = extractApiError(err) ?? t.fallback; }
    setMessages((prev) => {
      setTyping(prev.length);
      return [...prev, { from: 'sage', text: reply }];
    });
    setLoading(false);
    void refreshRate(); // cada respuesta consume cupo: refresca el contador
  }

  // Mensaje contextual pendiente (Dashboard, menú…): se envía al abrir.
  useEffect(() => {
    if (!pending || sentPending.current) return;
    sentPending.current = true; // StrictMode monta dos veces
    clearPending();
    if (lite) return; // Lite: va al diálogo de Pro, no al chat
    void askChat(pending);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [messages, loading, reduce]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-8))); } catch { /* sin storage */ }
  }, [messages]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || outOfCalls) return;
    setInput('');
    void askChat(text);
  }

  function runAction(a: (typeof ACTIONS)[number]) {
    if (loading || outOfCalls) return;
    void ask(t.actions[a.id], async () => {
      if (a.id === 'quests') {
        const { quests, raw } = await sageSuggestQuests();
        const list = Array.isArray(quests) ? (quests as Array<{ title: string; description: string; difficulty: string }>) : [];
        if (list.length) {
          return `${t.questsIntro}\n\n${list.map((q) => `• ${q.title} (${q.difficulty})\n  ${q.description}`).join('\n\n')}`;
        }
        // raw: texto del Sabio que no era JSON (p. ej. aviso de cuota agotada).
        return typeof raw === 'string' && raw.trim() ? raw : t.noQuests;
      }
      if (a.id === 'habits') return (await sageAnalyzeHabits()).reply;
      if (a.id === 'finances') return (await sageAnalyzeFinances()).reply;
      return (await sagePlanWorkout()).reply;
    });
  }

  if (lite) return null; // el efecto de arriba lo cierra y abre el diálogo de Pro

  return createPortal(
    <motion.div
      variants={scrim} initial="initial" animate="animate" exit="exit"
      className="fixed inset-0 z-[80] flex justify-end bg-[var(--scrim)]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        variants={drawer}
        className="flex h-full w-full flex-col bg-background text-on-background shadow-lg outline-none md:max-w-[440px] md:rounded-l-3xl md:border-l md:border-border"
      >
        <header className="flex items-center gap-3 border-b border-border py-3 pl-4 pr-2 pt-[max(0.75rem,env(safe-area-inset-top))] md:pl-6">
          <IconChip icon={Sparkles} tone="forest" size="sm" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-heading-sm">{t.title}</h2>
            <p className="text-body-sm text-on-surface-light">Tu consejero IA</p>
          </div>
          {rate && (
            <span
              title={t.rateTip}
              className={cn(
                'flex shrink-0 items-baseline gap-1 rounded-full border px-3 py-1 text-body-sm tabular-nums transition-colors',
                outOfCalls ? 'border-border text-on-surface-light' : rate.remaining <= rate.limit * 0.2 ? 'border-warning/40 text-on-background' : 'border-border text-on-background',
              )}
            >
              <span className="sr-only">Mensajes restantes hoy: </span>
              <motion.span
                key={rate.remaining}
                initial={reduce ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="font-medium"
              >
                {rate.remaining}
              </motion.span>
              <span aria-hidden className="text-on-surface-light">/ {rate.limit}</span>
              <span className="sr-only">{t.ofLimit(rate.limit)}</span>
              <span aria-hidden className="hidden text-on-surface-light sm:inline">hoy</span>
            </span>
          )}
          {messages.length > 0 && (
            <Button variant="icon" aria-label={t.clear} disabled={loading} onClick={() => { setMessages([]); setTyping(null); }}>
              <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
            </Button>
          )}
          <Button variant="icon" aria-label={t.close} onClick={onClose}>
            <X aria-hidden className="size-6" strokeWidth={1.75} />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
              <IconChip icon={Sparkles} tone="forest" size="lg" />
              <div className="flex max-w-[300px] flex-col gap-1">
                <p className="text-heading-sm">{t.askTitle}</p>
                <p className="text-body-md text-on-surface-light">{t.askBody}</p>
                {rate && !outOfCalls && (
                  <p className="text-body-sm text-on-surface-light">
                    {t.todayMsgs(rate.limit)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div role="log" aria-label={t.log} className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <Fragment key={i}>
                  <div
                    className={cn(
                      'max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-body-md',
                      m.from === 'user'
                        ? 'self-end rounded-br-md bg-primary-strong text-on-primary'
                        : 'self-start rounded-bl-md border border-border bg-surface text-on-background',
                    )}
                  >
                    <span className="sr-only">{m.from === 'user' ? t.youPrefix : t.sagePrefix}</span>
                    {m.from === 'sage' && i === typing ? <Typewriter text={m.text} /> : m.text}
                  </div>
                  {m.from === 'sage' && m.action && (
                    <GoalProposal
                      action={m.action} goalTitle={m.goalTitle} state={m.actionState}
                      onApply={() => void applyProposal(i, m.action!)}
                      onDismiss={() => setProposalState(i, 'dismissed')}
                    />
                  )}
                </Fragment>
              ))}
              {loading && (
                <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3">
                  <span aria-hidden className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="size-2 rounded-full bg-on-surface-light"
                        animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.18 }}
                      />
                    ))}
                  </span>
                  <span className="text-body-sm text-on-surface-light">{t.thinking}</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:px-6">
          <div aria-live="polite" className="flex flex-col gap-1">
            {callsUsed !== null && rate && !outOfCalls && rate.remaining <= rate.limit * 0.2 && (
              <p className="text-center text-body-sm text-on-surface-light">
                {t.tiredLine(rate.remaining)}
              </p>
            )}
            {outOfCalls && (
              <p className="text-center text-body-sm text-on-surface-light">
                El Sabio descansa hasta mañana. Todo lo demás (hábitos, misiones, comidas, inicio) sigue
                funcionando con normalidad.
              </p>
            )}
          </div>
          <ul aria-label={t.quickActions} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {ACTIONS.map((a) => (
              <li key={a.id} className="shrink-0">
                <Button variant="secondary" size="sm" disabled={loading || outOfCalls} onClick={() => runAction(a)}>
                  <a.icon aria-hidden className="size-4" strokeWidth={1.75} />{t.actions[a.id]}
                </Button>
              </li>
            ))}
          </ul>
          <form onSubmit={submit} className="flex items-center gap-2">
            <Input
              aria-label={t.inputAria}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={outOfCalls ? t.returnTomorrow : t.typePlaceholder}
              maxLength={500}
              disabled={outOfCalls}
              data-autofocus={isDesktop || undefined}
            />
            <Button type="submit" aria-label={t.send} disabled={!input.trim() || loading || outOfCalls} className="size-12 shrink-0 rounded-full p-0">
              <Send aria-hidden className="size-5" strokeWidth={1.75} />
            </Button>
          </form>
          <p className="text-center text-body-sm text-on-surface-light">{t.disclaimer}</p>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
