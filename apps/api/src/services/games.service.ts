// Minijuegos dentro de una carta (de dos amigos o de un gremio). Cada partida es
// un mensaje de tipo GAME cuyo estado vive en su `meta.game`; cada jugada lo
// actualiza y suena el timbre de todos (se ve en vivo).
//   Tres en raya (ttt): quien reta juega con X; en un gremio, quien hace la
//     primera jugada contraria se queda con O.
//   Piedra, papel o tijera (rps): un duelo. Cada uno elige en secreto (nadie ve
//     la elección del otro) y al elegir el segundo se revelan las dos.
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { bump, dmKey, isViewing, publicMeta } from './chat-live.service';
import { createDirectMessage } from './dm.service';
import { createGuildMessage } from './social.service';
import { createNotification } from './notification.service';
import { letterLink } from './network.service';
import { participants, scopeOf } from './letters.service';

export type Mark = 'X' | 'O';
export interface TttGame {
  type: 'ttt';
  board: Array<Mark | ''>;
  players: { X: string; O: string | null };
  turn: Mark;
  winner: Mark | 'draw' | null;
  line: number[] | null;
}
export type RpsPick = 'r' | 'p' | 's';
export interface RpsGame {
  type: 'rps';
  players: string[];
  picks: Record<string, RpsPick>;
  winner: string | 'draw' | null;
}
export type Game = TttGame | RpsGame;
export const GAME_TYPES = ['ttt', 'rps'] as const;

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const BEATS: Record<RpsPick, RpsPick> = { r: 's', p: 'r', s: 'p' };

export function newGame(type: string, starter: string, opponent: string | null): Game {
  if (type === 'ttt') return { type, board: Array<Mark | ''>(9).fill(''), players: { X: starter, O: opponent }, turn: 'X', winner: null, line: null };
  if (type === 'rps') return { type, players: opponent ? [starter, opponent] : [starter], picks: {}, winner: null };
  throw new Error('Ese juego no existe');
}

/** Aplica una jugada (o lanza un error con el motivo si no vale). Pura: no toca la base. */
export function applyMove(game: Game, player: string, move: unknown): Game {
  if (game.winner) throw new Error('Esta partida ya terminó');
  if (game.type === 'ttt') {
    const cell = typeof move === 'number' ? move : Number(move);
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) throw new Error('Casilla no válida');
    const players = { ...game.players };
    // En un gremio, el primero que juega contra quien retó se queda con la O.
    if (!players.O && player !== players.X) players.O = player;
    const mark: Mark | null = players.X === player ? 'X' : players.O === player ? 'O' : null;
    if (!mark) throw new Error('Esta partida es entre otras dos personas');
    if (mark !== game.turn) throw new Error('Todavía no es tu turno');
    if (game.board[cell]) throw new Error('Esa casilla ya está ocupada');
    const board = [...game.board];
    board[cell] = mark;
    const line = LINES.find((l) => l.every((i) => board[i] === mark)) ?? null;
    const full = board.every(Boolean);
    return { ...game, board, players, turn: mark === 'X' ? 'O' : 'X', winner: line ? mark : full ? 'draw' : null, line };
  }
  const pick: RpsPick | null = move === 'r' || move === 'p' || move === 's' ? move : null;
  if (!pick) throw new Error('Elige piedra, papel o tijera');
  const players = game.players.includes(player) ? game.players : game.players.length < 2 ? [...game.players, player] : null;
  if (!players) throw new Error('Este duelo es entre otras dos personas');
  if (game.picks[player]) throw new Error('Ya elegiste');
  const picks: Record<string, RpsPick> = { ...game.picks, [player]: pick };
  if (players.length < 2 || Object.keys(picks).length < 2) return { ...game, players, picks };
  const [a, b] = players;
  const winner = picks[a] === picks[b] ? 'draw' : BEATS[picks[a]] === picks[b] ? a : b;
  return { ...game, players, picks, winner };
}

const gameName = (type: string) => (type === 'ttt' ? 'tres en raya' : 'piedra, papel o tijera');

/** Reta a una partida en una carta: queda como un mensaje que todos ven. */
export async function startGame(me: string, chat: unknown, type: unknown) {
  if (typeof type !== 'string' || !(GAME_TYPES as readonly string[]).includes(type)) throw new Error('Ese juego no existe');
  const scope = scopeOf(chat);
  await participants(me, scope);
  const game = newGame(type, me, scope.side === 'dm' ? scope.otherId : null);
  const out = { kind: 'GAME', content: '', photoUrl: null, audioUrl: null, meta: { game } };
  return scope.side === 'dm' ? (await createDirectMessage(me, scope.otherId, out)).message : createGuildMessage(me, scope.guildId, out);
}

/** Una jugada en una partida. Protegida contra jugadas simultáneas. */
export async function playMove(me: string, side: unknown, messageId: string, move: unknown) {
  const s = side === 'guild' ? 'guild' : 'dm';
  const row = s === 'dm'
    ? await prisma.directMessage.findFirst({ where: { id: messageId, kind: 'GAME', deletedAt: null, OR: [{ senderId: me }, { receiverId: me }] }, select: { id: true, meta: true, changedAt: true, senderId: true, receiverId: true } })
    : await prisma.guildMessage.findFirst({ where: { id: messageId, kind: 'GAME', deletedAt: null }, select: { id: true, meta: true, changedAt: true, guildId: true } });
  if (!row) throw new Error('Partida no encontrada');
  const scope = 'guildId' in row ? scopeOf(`guild:${row.guildId}`) : scopeOf(`dm:${row.senderId === me ? row.receiverId : row.senderId}`);
  const people = await participants(me, scope);
  const meta = (row.meta && typeof row.meta === 'object' ? row.meta : {}) as { game?: Game };
  if (!meta.game) throw new Error('Partida no encontrada');
  const next = applyMove(meta.game, me, move);
  const data = { meta: { ...meta, game: next } as unknown as Prisma.InputJsonValue, changedAt: new Date() };
  // Solo se guarda si nadie jugó entre medias (si no, que lo intente otra vez).
  const guard = { id: row.id, changedAt: row.changedAt };
  const r = s === 'dm' ? await prisma.directMessage.updateMany({ where: guard, data }) : await prisma.guildMessage.updateMany({ where: guard, data });
  if (!r.count) throw new Error('Alguien jugó a la vez. Vuelve a intentarlo.');
  await bump(people);

  // A quien le toca (en una carta de dos), un aviso si no la tiene abierta.
  if (scope.side === 'dm' && !next.winner && (next.type === 'ttt' ? next.players[next.turn] === scope.otherId : !next.picks[scope.otherId])) {
    if (!(await isViewing(scope.otherId, dmKey(me)))) {
      const who = await prisma.user.findUnique({ where: { id: me }, select: { displayName: true, username: true } });
      if (who) {
        createNotification(scope.otherId, {
          type: 'friend', category: 'SOCIAL', dedupeKey: `game:${row.id}`,
          title: `Tu turno en ${gameName(next.type)}`, body: `${who.displayName} ya jugó.`, icon: 'friend', link: letterLink(who.username),
        }).catch(() => null);
      }
    }
  }
  return { id: row.id, game: publicMeta({ game: next }, me)?.game };
}
