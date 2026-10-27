// Minijuegos dentro de la carta, dibujados a mano sobre una hoja:
//   Tres en raya: el tablero son cuatro trazos de tinta; cada X y cada O se
//     dibujan al ponerse y la línea ganadora se tacha.
//   Piedra, papel o tijera: cada uno elige en secreto (al otro le llega un sobre
//     cerrado) y, cuando eligen los dos, las manos se agitan y se revelan.
// Se juega en vivo: la jugada del otro aparece al momento.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useText, type Copy } from '@/lib/i18n';
import type { Game, RpsGame, RpsPick, TttGame } from '@/services/network.service';

const es = {
  ttt: 'Tres en raya',
  rps: 'Piedra, papel o tijera',
  board: 'Tablero de tres en raya',
  cell: (n: number, v: string): string => `Casilla ${n}: ${v}`,
  cross: 'equis',
  ring: 'círculo',
  empty: 'vacía',
  draw: 'Empate. Nadie gana esta.',
  won: '¡Ganaste!',
  wonBy: (name: string): string => `Ganó ${name}`,
  yourTurn: 'Te toca',
  theirTurn: (name: string): string => `Le toca a ${name}`,
  anyone: 'quien quiera',
  rpsDraw: '¡Empate! Mismo gesto.',
  revealing: 'Revelando…',
  waitingFor: (name: string): string => `Esperando a ${name}`,
  yourRival: 'tu rival',
  alreadyPicked: (name: string): string => `${name} ya eligió. Te toca.`,
  pickSecret: 'Elige en secreto',
  you: 'Tú',
  hands: { r: 'Piedra', p: 'Papel', s: 'Tijera' } as Record<RpsPick, string>,
};

const en: typeof es = {
  ttt: 'Tic-tac-toe',
  rps: 'Rock, paper or scissors',
  board: 'Tic-tac-toe board',
  cell: (n: number, v: string): string => `Square ${n}: ${v}`,
  cross: 'cross',
  ring: 'circle',
  empty: 'empty',
  draw: 'Draw. Nobody wins this one.',
  won: 'You won!',
  wonBy: (name: string): string => `${name} won`,
  yourTurn: 'Your turn',
  theirTurn: (name: string): string => `It is ${name}’s turn`,
  anyone: 'anyone',
  rpsDraw: 'Draw! Same move.',
  revealing: 'Revealing…',
  waitingFor: (name: string): string => `Waiting for ${name}`,
  yourRival: 'your rival',
  alreadyPicked: (name: string): string => `${name} has already picked. Your turn.`,
  pickSecret: 'Pick in secret',
  you: 'You',
  hands: { r: 'Rock', p: 'Paper', s: 'Scissors' } as Record<RpsPick, string>,
};

const COPY: Copy<typeof es> = { es, en };

const RPS: Array<{ id: RpsPick; hand: string }> = [
  { id: 'r', hand: '✊' },
  { id: 'p', hand: '✋' },
  { id: 's', hand: '✌️' },
];
const handOf = (p?: RpsPick) => RPS.find((r) => r.id === p);

interface Props {
  game: Game;
  meId: string;
  /** Nombre (de pila) de cada jugador. */
  nameOf: (userId: string) => string;
  onMove: (move: number | RpsPick) => Promise<void>;
  /** En un gremio cualquiera puede ser el rival. */
  group: boolean;
}

function Mark({ mark, reduce }: { mark: 'X' | 'O'; reduce: boolean }) {
  const draw = reduce ? { pathLength: 1 } : { pathLength: [0, 1] };
  const t = { duration: reduce ? 0 : 0.35, ease: 'easeOut' as const };
  return (
    <svg viewBox="0 0 40 40" className={cn('size-[70%]', mark === 'X' ? 'text-primary-text' : 'text-error-text')} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
      {mark === 'X' ? (
        <>
          <motion.path d="M9 9 L31 31" initial={false} animate={draw} transition={t} />
          <motion.path d="M31 9 L9 31" initial={false} animate={draw} transition={{ ...t, delay: reduce ? 0 : 0.18 }} />
        </>
      ) : (
        <motion.path d="M20 7 a13 13 0 1 1 -0.1 0" initial={false} animate={draw} transition={{ ...t, duration: reduce ? 0 : 0.45 }} />
      )}
    </svg>
  );
}

function Ttt({ game, meId, nameOf, onMove, group }: Props & { game: TttGame }) {
  const t = useText(COPY);
  const reduce = useMotionStore((s) => s.reduce);
  const [busy, setBusy] = useState<number | null>(null);
  const myMark = game.players.X === meId ? 'X' : game.players.O === meId ? 'O' : null;
  const canJoin = !myMark && !game.players.O && group && game.players.X !== meId;
  const myTurn = !game.winner && (myMark === game.turn || (canJoin && game.turn === 'O'));
  const turnName = game.players[game.turn] ? nameOf(game.players[game.turn]!) : t.anyone;
  const status = game.winner === 'draw' ? t.draw
    : game.winner ? (game.players[game.winner] === meId ? t.won : t.wonBy(nameOf(game.players[game.winner] ?? '')))
      : myTurn ? t.yourTurn : t.theirTurn(turnName);
  // Coordenadas del centro de cada casilla (para tachar la línea ganadora).
  const center = (i: number) => [20 + (i % 3) * 40, 20 + Math.floor(i / 3) * 40];
  const [a, , c] = game.line ?? [];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative aspect-square w-[min(200px,56vw)]">
        <svg aria-hidden="true" viewBox="0 0 120 120" className="pointer-events-none absolute inset-0 size-full text-on-surface-light" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M41 6 q-1.5 54 0.5 108" /><path d="M80 7 q1.5 54 -0.5 107" />
          <path d="M6 40 q54 -1.5 108 0.5" /><path d="M7 80 q54 1.5 107 -0.5" />
        </svg>
        <div role="grid" aria-label={t.board} className="relative grid size-full grid-cols-3 grid-rows-3">
          {game.board.map((cell, i) => (
            <button
              key={i} type="button" role="gridcell" disabled={Boolean(cell) || !myTurn || busy !== null}
              onClick={async () => { setBusy(i); try { await onMove(i); } finally { setBusy(null); } }}
              aria-label={t.cell(i + 1, cell === 'X' ? t.cross : cell === 'O' ? t.ring : t.empty)}
              className={cn('flex items-center justify-center rounded-lg transition-colors', !cell && myTurn && 'hover:bg-primary/[0.08] focus-visible:bg-primary/[0.08]')}
            >
              {cell ? <Mark mark={cell} reduce={reduce} /> : busy === i ? <span className="size-2 animate-pulse rounded-full bg-on-surface-light" /> : null}
            </button>
          ))}
        </div>
        {game.line && a !== undefined && c !== undefined && (
          <svg aria-hidden="true" viewBox="0 0 120 120" className="pointer-events-none absolute inset-0 size-full text-warning-text">
            <motion.line
              x1={center(a)[0]} y1={center(a)[1]} x2={center(c)[0]} y2={center(c)[1]}
              stroke="currentColor" strokeWidth="5" strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.3 }}
            />
          </svg>
        )}
      </div>
      <motion.p key={status} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn('text-label-lg', myTurn ? 'text-primary-text' : 'text-on-surface-light')}>
        {status}
      </motion.p>
    </div>
  );
}

function Rps({ game, meId, nameOf, onMove }: Props & { game: RpsGame }) {
  const t = useText(COPY);
  const reduce = useMotionStore((s) => s.reduce);
  const [busy, setBusy] = useState<RpsPick | null>(null);
  const inGame = game.players.includes(meId);
  const canPlay = !game.winner && !game.picks[meId] && (inGame || game.players.length < 2);
  const opponent = game.players.find((p) => p !== meId);
  const picked = game.picked ?? Object.keys(game.picks);
  const status = game.winner === 'draw' ? t.rpsDraw
    : game.winner ? (game.winner === meId ? t.won : t.wonBy(nameOf(game.winner)))
      : game.picks[meId] ? (opponent && picked.includes(opponent) ? t.revealing : t.waitingFor(opponent ? nameOf(opponent) : t.yourRival))
        : opponent && picked.includes(opponent) ? t.alreadyPicked(nameOf(opponent)) : t.pickSecret;
  return (
    <div className="flex flex-col items-center gap-2.5">
      {game.winner ? (
        <div className="flex items-center gap-5">
          {game.players.map((p, i) => (
            <div key={p} className="flex flex-col items-center gap-1">
              <motion.span
                aria-hidden="true" className="block text-[2.6rem] leading-none"
                initial={reduce ? false : { rotate: i ? 20 : -20, y: 0 }}
                animate={reduce ? undefined : { y: [0, -10, 0, -10, 0, -10, 0], rotate: 0 }}
                transition={{ duration: 0.9 }}
                style={{ scaleX: i ? -1 : 1 }}
              >
                {handOf(game.picks[p])?.hand}
              </motion.span>
              <span className={cn('text-label-md', game.winner === p ? 'text-success-text' : 'text-on-surface-light')}>{p === meId ? t.you : nameOf(p)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          {RPS.map((r) => (
            <motion.button
              key={r.id} type="button" disabled={!canPlay || busy !== null}
              whileTap={reduce ? undefined : { scale: 0.88, rotate: -6 }}
              onClick={async () => { setBusy(r.id); try { await onMove(r.id); } finally { setBusy(null); } }}
              aria-label={t.hands[r.id]} aria-pressed={game.picks[meId] === r.id}
              className={cn('flex size-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 bg-surface text-[1.6rem] leading-none transition-colors',
                game.picks[meId] === r.id ? 'border-primary' : 'border-border-strong/50', canPlay ? 'hover:border-primary/60' : 'opacity-60')}
            >
              <span aria-hidden="true">{r.hand}</span>
              <span className="text-[0.66rem] font-semibold text-on-surface-light">{t.hands[r.id]}</span>
            </motion.button>
          ))}
        </div>
      )}
      <motion.p key={status} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={springs.natural}
        className={cn('text-label-lg', canPlay ? 'text-primary-text' : 'text-on-surface-light')}>
        {status}
      </motion.p>
    </div>
  );
}

export function GameCard(props: Props) {
  const t = useText(COPY);
  const reduce = useMotionStore((s) => s.reduce);
  const { game } = props;
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.9, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={springs.natural}
      className="lq-game-card flex min-w-[230px] flex-col items-center gap-2 rounded-[14px] px-4 pb-3 pt-2.5"
    >
      <span className="flex items-center gap-1.5 self-start text-label-md text-on-surface-light">
        <Gamepad2 aria-hidden className="size-4" strokeWidth={1.8} />{game.type === 'ttt' ? t.ttt : t.rps}
      </span>
      {game.type === 'ttt' ? <Ttt {...props} game={game} /> : <Rps {...props} game={game} />}
    </motion.div>
  );
}
