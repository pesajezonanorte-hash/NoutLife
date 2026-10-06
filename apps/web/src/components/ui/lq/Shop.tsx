// Tienda: ShopItem, PurchaseDialog y ThemePreviewDialog (prototipo ShopDesktop).
// Zona ambientada: un pasaje comercial. Cada artículo es un escaparate con el toldo
// de su categoría que se despliega, una luz que se enciende, el artículo sobre un
// pedestal que gira al pasar y su etiqueta de precio colgada que se mece y destella;
// al comprar, el artículo cae dentro de la bolsa.
import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, Coins, Eye, ShoppingBag, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { expo, pop3 } from '@/lib/motion';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { IconChip } from './IconChip';
import { Modal } from './Modal';
import type { Tone } from './tones';
import { Awning, PriceTag, ShopWindow, winVars } from '@/components/shop/Storefront';

const gold = (n: number) => n.toLocaleString('es-CO');

/** Precio en Gold: moneda + cifra mono. */
export function GoldPrice({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono tabular-nums text-warning-text', className)}>
      <Coins aria-hidden className="size-4" strokeWidth={1.75} />{gold(value)}
      <span className="sr-only"> Gold</span>
    </span>
  );
}

export interface ShopItemProps {
  name: string;
  description?: string;
  price: number;
  icon: LucideIcon;
  tone?: Tone;
  category?: string;
  owned?: boolean;
  affordable?: boolean;
  busy?: boolean;
  onBuy: () => void;
  /** Temas: botón «Ver» con vista previa. */
  onPreview?: () => void;
  /** Bloqueado por nivel: el escaparate queda en penumbra. */
  locked?: boolean;
  /** Posición en la lista: los escaparates se encienden uno tras otro. */
  index?: number;
  /** Cómo se ve el artículo (tu personaje con él puesto, el aura, el tema…): ocupa el lugar del ícono. */
  visual?: ReactNode;
  /** Etiquetas junto a la categoría (exclusivo, unidades que quedan). */
  badges?: ReactNode;
  /** Comprado y para el personaje: el botón lo pone o lo quita. */
  worn?: boolean;
  onWear?: () => void;
  /** Exclusivo sin unidades. */
  soldOut?: boolean;
  className?: string;
}

export function ShopItem({ name, description, price, icon, tone = 'primary', category, owned, affordable = true, busy, onBuy, onPreview, locked, index = 0, visual, badges, worn, onWear, soldOut, className }: ShopItemProps) {
  const delay = 0.4 + index * 0.09;
  return (
    <Card interactive padding="none" style={winVars(tone)} className={cn('group relative isolate flex h-full flex-col overflow-hidden', className)}>
      <Awning delay={delay} className="relative z-10" />
      <ShopWindow
        lit={!locked} delay={delay + 0.3}
        className={cn('mx-4 -mt-[11px] rounded-b-xl', visual ? 'aspect-[4/3]' : 'aspect-[16/9]')}
        tag={<PriceTag><GoldPrice value={price} className="text-label-lg" /></PriceTag>}
      >
        {visual ?? <IconChip icon={icon} tone={tone} size="lg" className="rounded-2xl" />}
      </ShopWindow>
      {owned && (
        <span aria-hidden="true" className="absolute left-7 top-10 z-10 inline-flex items-center gap-1 rounded-full bg-success-strong px-2 py-0.5 text-label-md text-on-success shadow-sm">
          <Check className="size-3.5" strokeWidth={2.25} />Tuyo
        </span>
      )}
      <div className="flex flex-1 flex-col gap-2 px-5 pb-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-heading-sm">{name}</h3>
          {category && <Badge className="shrink-0">{category}</Badge>}
        </div>
        {badges && <div className="flex flex-wrap gap-1.5">{badges}</div>}
        {description && <p className="text-body-sm text-on-surface-light">{description}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-2">
          {onPreview && (
            <Button variant="ghost" size="md" onClick={onPreview} aria-label={`Vista previa de ${name}`}>
              <Eye aria-hidden className="size-4" strokeWidth={1.75} />Ver
            </Button>
          )}
          {owned && onWear ? (
            <Button variant={worn ? 'secondary' : 'primary'} size="md" loading={busy} aria-pressed={worn} onClick={onWear}>
              {worn ? 'Quitármelo' : 'Ponérmelo'}
            </Button>
          ) : (
            <Button
              variant={owned ? 'secondary' : 'primary'} size="md" loading={busy}
              disabled={owned || soldOut || locked || !affordable}
              onClick={onBuy}
              aria-label={owned ? `${name}: ya lo tienes` : soldOut ? `${name}: agotado` : locked ? `${name}: aún bloqueado por nivel` : `Comprar ${name} por ${price} Gold`}
            >
              {owned ? 'Tienes' : soldOut ? 'Agotado' : locked ? 'Bloqueado' : affordable ? 'Comprar' : 'Sin Gold'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export interface PurchaseDialogProps {
  open: boolean;
  /** Ícono del artículo: cae dentro de la bolsa al terminar. */
  icon?: LucideIcon;
  name: string;
  price: number;
  balance: number;
  phase: 'ask' | 'done';
  busy?: boolean;
  /** Al terminar: el artículo ya puesto (tu personaje con él) en lugar de la bolsa. */
  visual?: ReactNode;
  /** Texto al terminar (por defecto: «… ya está en tu inventario.»). */
  doneText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmar compra → «¡Es tuyo!» con pop + halo. */
export function PurchaseDialog({ open, icon: ItemIcon, name, price, balance, phase, busy, visual, doneText, onConfirm, onClose }: PurchaseDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={phase === 'ask' ? `¿Comprar ${name}?` : '¡Es tuyo!'} hideClose={phase === 'done'}>
      {phase === 'ask' ? (
        <div className="flex flex-col gap-4">
          <p className="text-body-md text-on-surface">
            Se descontarán <b className="font-mono text-warning-text">{gold(price)} Gold</b>. Te quedarán <span className="font-mono">{gold(balance - price)}</span>.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
            <Button size="md" loading={busy} onClick={onConfirm}>Comprar</Button>
          </div>
        </div>
      ) : visual ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <motion.span variants={pop3} initial="initial" animate="animate" className="lq-halo flex items-end justify-center rounded-[28px] bg-surface-variant px-6 pt-4">
            {visual}
          </motion.span>
          <p className="text-body-md text-on-surface-light">{doneText ?? `${name} ya está en tu inventario.`}</p>
          <Button block onClick={onClose} autoFocus>Genial</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="relative flex flex-col items-center pt-10">
            {/* El artículo cae dentro de la bolsa y la bolsa lo recibe */}
            {ItemIcon && (
              <motion.span
                aria-hidden="true"
                className="absolute top-0 flex size-10 items-center justify-center rounded-xl bg-surface-variant text-on-surface shadow-md"
                initial={{ y: -10, opacity: 0, scale: 1 }}
                animate={{ y: [-10, 0, 40], opacity: [0, 1, 0], scale: [1, 1, 0.5], transition: { duration: 0.9, times: [0, 0.3, 1], ease: ['easeOut', [0.5, 0, 0.75, 0]] } }}
              >
                <ItemIcon className="size-5" strokeWidth={1.75} />
              </motion.span>
            )}
            <motion.span variants={pop3} initial="initial" animate="animate" className="lq-halo rounded-full">
              <motion.span className="block" animate={{ scale: [1, 1.14, 0.97, 1], transition: { delay: 0.72, duration: 0.55, ease: 'easeOut' } }}>
                <IconChip icon={ShoppingBag} tone="warning" size="lg" className="rounded-full" />
              </motion.span>
            </motion.span>
          </span>
          <p className="text-body-md text-on-surface-light">{doneText ?? `${name} ya está en tu inventario.`}</p>
          <Button block onClick={onClose} autoFocus>Genial</Button>
        </div>
      )}
    </Modal>
  );
}

export interface ThemePalette {
  /** Superficie, acento, acento suave, fondo, texto (colores del tema: dato del catálogo). */
  surface: string;
  accent: string;
  soft: string;
  background: string;
  text: string;
}

export interface ThemePreviewDialogProps {
  open: boolean;
  name: string;
  price: number;
  palette: ThemePalette;
  owned?: boolean;
  onBuy: () => void;
  onClose: () => void;
}

/** Vista previa del tema: mini app pintada con la paleta del tema + «Comprar tema». */
export function ThemePreviewDialog({ open, name, price, palette, owned, onBuy, onClose }: ThemePreviewDialogProps) {
  const v = {
    '--tp-surface': palette.surface, '--tp-accent': palette.accent, '--tp-soft': palette.soft,
    '--tp-bg': palette.background, '--tp-text': palette.text,
  } as CSSProperties;
  return (
    <Modal open={open} onClose={onClose} title={name} className="md:max-w-[560px]">
      <motion.div
        variants={pop3} initial="initial" animate="animate"
        role="img" aria-label={`Vista previa de la app con el tema ${name}`}
        style={v}
        className="flex gap-4 overflow-hidden rounded-[20px] bg-[var(--tp-bg)] p-5 shadow-lg"
      >
        <div aria-hidden className="flex w-14 flex-col gap-2.5">
          <span className="h-8 rounded-[10px] bg-[var(--tp-accent)]" />
          {[0, 1, 2].map((i) => <span key={i} className="h-2.5 rounded-[5px] bg-[var(--tp-surface)]" />)}
        </div>
        <div aria-hidden className="flex flex-1 flex-col gap-3">
          <span className="text-[1.375rem] font-bold text-[var(--tp-text)]">Buenos días</span>
          <div className="flex flex-col gap-2.5 rounded-[14px] bg-[var(--tp-surface)] p-3.5">
            <span className="text-[0.8125rem] font-semibold text-[var(--tp-text)]">Nivel y XP</span>
            <span className="h-2 overflow-hidden rounded-full bg-[var(--tp-bg)]">
              <motion.span className="block h-full w-[78%] origin-left bg-[var(--tp-soft)]"
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.2, ease: expo, delay: 0.3 }} />
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <span className="h-16 rounded-xl bg-[var(--tp-surface)]" /><span className="h-16 rounded-xl bg-[var(--tp-surface)]" />
          </div>
          <span className="self-start rounded-[10px] bg-[var(--tp-accent)] px-3.5 py-2 text-[0.8125rem] font-semibold text-[var(--tp-text)]">Nuevo hábito</span>
        </div>
      </motion.div>
      <div aria-hidden className="flex gap-2">
        {[palette.surface, palette.accent, palette.soft, palette.background, palette.text].map((c, i) => (
          <span key={i} className="h-7 flex-1 rounded-md border border-border" style={{ background: c }} />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GoldPrice value={price} className="text-heading-sm" />
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={onClose}>Cerrar</Button>
          <Button size="md" disabled={owned} onClick={onBuy}>{owned ? 'Ya lo tienes' : 'Comprar tema'}</Button>
        </div>
      </div>
    </Modal>
  );
}
