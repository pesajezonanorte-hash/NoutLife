// Tienda: ShopItem, PurchaseDialog y ThemePreviewDialog (prototipo ShopDesktop).
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Coins, Eye, ShoppingBag, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { expo, pop3 } from '@/lib/motion';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { IconChip } from './IconChip';
import { Modal } from './Modal';
import type { Tone } from './tones';

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
  className?: string;
}

export function ShopItem({ name, description, price, icon, tone = 'primary', category, owned, affordable = true, busy, onBuy, onPreview, className }: ShopItemProps) {
  return (
    <Card as="li" interactive padding="lg" className={cn('flex flex-col gap-3.5', className)}>
      <div className="flex items-start justify-between gap-2">
        <IconChip icon={icon} tone={tone} className="size-14 rounded-2xl [&>svg]:size-8" />
        {category && <Badge>{category}</Badge>}
      </div>
      <div>
        <h3 className="text-heading-sm">{name}</h3>
        {description && <p className="text-body-sm text-on-surface-light">{description}</p>}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <GoldPrice value={price} className="text-label-lg md:text-body-md md:font-semibold" />
        <span className="flex gap-2">
          {onPreview && (
            <Button variant="ghost" size="md" onClick={onPreview} aria-label={`Vista previa de ${name}`}>
              <Eye aria-hidden className="size-4" strokeWidth={1.75} />Ver
            </Button>
          )}
          <Button
            variant={owned ? 'secondary' : 'primary'} size="md" loading={busy}
            disabled={owned || !affordable}
            onClick={onBuy}
            aria-label={owned ? `${name}: ya lo tienes` : `Comprar ${name} por ${price} Gold`}
          >
            {owned ? 'Tienes' : affordable ? 'Comprar' : 'Sin Gold'}
          </Button>
        </span>
      </div>
    </Card>
  );
}

export interface PurchaseDialogProps {
  open: boolean;
  name: string;
  price: number;
  balance: number;
  phase: 'ask' | 'done';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmar compra → «¡Es tuyo!» con pop + halo. */
export function PurchaseDialog({ open, name, price, balance, phase, busy, onConfirm, onClose }: PurchaseDialogProps) {
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
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <motion.span variants={pop3} initial="initial" animate="animate" className="lq-halo rounded-full">
            <IconChip icon={ShoppingBag} tone="warning" size="lg" className="rounded-full" />
          </motion.span>
          <p className="text-body-md text-on-surface-light">{name} ya está en tu inventario.</p>
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
          <span key={i} className="h-7 flex-1 rounded-lg border border-border" style={{ background: c }} />
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
