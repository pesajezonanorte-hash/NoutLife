// Carteras: dónde está el dinero. Cada cartera es una tarjeta de vidrio que se inclina (billetera digital,
// cuenta, tarjeta de crédito o débito, efectivo u otro activo) con su saldo; las de crédito miden el cupo
// usado. Tocar una filtra toda la página por esa cartera. Arriba, el patrimonio: lo que hay menos lo que se
// debe. Pasar dinero de una a otra (o pagar una tarjeta) es un traslado: no cuenta como ingreso ni gasto.
import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Archive, Banknote, CreditCard, Gem, Landmark, Pencil, Plus, RotateCcw, Smartphone, Trash2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { heavy } from '@/lib/motion';
import { AccordionItem, AnimatedValue, Button, ChipGroup, DatePicker, Field, Input, ResponsiveDialog, Select } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';
import { coversFor } from '@/components/notebook/paper';
import * as api from '@/services/wallet.service';
import type { AccountColor, AccountKind, FinanceAccount, FinanceTransfer, WalletTotals } from '@/services/wallet.service';

const es = {
  title: 'Carteras',
  desc: 'Dónde está tu dinero: billeteras, cuentas, tarjetas y efectivo.',
  add: 'Cartera',
  transfer: 'Traslado',
  netWorth: 'Patrimonio',
  inWallets: 'En carteras',
  owed: 'Debes',
  unassigned: 'Sin cartera',
  unassignedNote: 'Hay movimientos sin cartera. Abre un movimiento para asignarle una.',
  emptyTitle: 'Separa tu dinero por dónde está',
  emptyBody: 'Crea una cartera por cada sitio donde tienes plata. Cada movimiento sale de una, y ves el saldo de todas al instante.',
  quick: [
    { name: 'Nequi', kind: 'WALLET' }, { name: 'Daviplata', kind: 'WALLET' }, { name: 'Efectivo', kind: 'CASH' },
    { name: 'Cuenta de ahorros', kind: 'BANK' }, { name: 'Tarjeta de crédito', kind: 'CREDIT_CARD' },
  ] as { name: string; kind: AccountKind }[],
  kinds: { WALLET: 'Billetera digital', BANK: 'Cuenta bancaria', CREDIT_CARD: 'Tarjeta de crédito', DEBIT_CARD: 'Tarjeta débito', CASH: 'Efectivo', ASSET: 'Otro activo' } as Record<AccountKind, string>,
  showOnly: (name: string): string => `Ver solo ${name}`,
  showingOnly: (name: string): string => `Viendo solo ${name}`,
  showAll: 'Ver todas',
  editOf: (name: string): string => `Editar ${name}`,
  owes: 'Debes',
  available: (v: string): string => `Disponible ${v}`,
  usage: (p: number): string => `${p} % del cupo usado`,
  cycle: (v: string): string => `${v} desde el corte`,
  month: (v: string): string => `${v} gastados este mes`,
  dueOn: (d: string): string => `Pagas el ${d}`,
  archived: (n: number): string => `Carteras archivadas (${n})`,
  restore: 'Restaurar',
  delete: 'Eliminar',
  archive: 'Archivar',
  cancel: 'Cancelar',
  save: 'Guardar',
  create: 'Crear',
  saved: 'Cartera guardada',
  archivedOk: 'Cartera archivada',
  restored: 'Cartera restaurada',
  deleted: 'Cartera eliminada',
  fail: 'No se pudo guardar. Inténtalo de nuevo.',
  newTitle: 'Nueva cartera',
  editTitle: 'Editar cartera',
  name: 'Nombre',
  namePh: 'Ej. Nequi',
  nameErr: 'Ponle nombre a la cartera',
  kind: 'Tipo',
  provider: 'Banco o entidad',
  optional: 'Opcional',
  last4: 'Últimos 4 dígitos',
  last4Help: 'Solo para reconocerla. Nunca escribas el número completo.',
  last4Err: 'Son 4 dígitos',
  color: 'Color',
  opening: 'Saldo actual',
  openingHelp: 'Lo que hay hoy. Los movimientos que registres lo irán cambiando.',
  openingCard: 'Lo que debes hoy',
  openingCardHelp: 'Lo que ya llevas gastado en la tarjeta. Deja 0 si está al día.',
  limit: 'Cupo',
  cutoff: 'Día de corte',
  due: 'Día de pago',
  dayErr: 'Un día entre 1 y 31',
  numberErr: 'Escribe un número válido',
  transferTitle: 'Traslado entre carteras',
  transferNote: 'Un traslado no cuenta como ingreso ni gasto. Pagar una tarjeta de crédito es un traslado hacia ella.',
  from: 'Sale de',
  to: 'Entra a',
  amount: 'Monto',
  amountErr: 'Escribe un monto mayor que 0',
  sameErr: 'Elige dos carteras distintas',
  date: 'Fecha',
  note: 'Nota',
  doTransfer: 'Trasladar',
  transferred: 'Traslado registrado',
  recent: 'Traslados recientes',
  undoTransfer: (label: string): string => `Deshacer traslado ${label}`,
  transferDeleted: 'Traslado deshecho',
};

const en: typeof es = {
  title: 'Wallets',
  desc: 'Where your money is: e-wallets, accounts, cards and cash.',
  add: 'Wallet',
  transfer: 'Transfer',
  netWorth: 'Net worth',
  inWallets: 'In wallets',
  owed: 'You owe',
  unassigned: 'No wallet',
  unassignedNote: 'Some movements have no wallet. Open a movement to give it one.',
  emptyTitle: 'Split your money by where it is',
  emptyBody: 'Create a wallet for each place you keep money. Every movement comes out of one, and you see every balance at a glance.',
  quick: [
    { name: 'Cash', kind: 'CASH' }, { name: 'Checking account', kind: 'BANK' }, { name: 'Savings account', kind: 'BANK' },
    { name: 'Credit card', kind: 'CREDIT_CARD' }, { name: 'PayPal', kind: 'WALLET' },
  ] as { name: string; kind: AccountKind }[],
  kinds: { WALLET: 'E-wallet', BANK: 'Bank account', CREDIT_CARD: 'Credit card', DEBIT_CARD: 'Debit card', CASH: 'Cash', ASSET: 'Other asset' } as Record<AccountKind, string>,
  showOnly: (name: string): string => `Show only ${name}`,
  showingOnly: (name: string): string => `Showing only ${name}`,
  showAll: 'Show all',
  editOf: (name: string): string => `Edit ${name}`,
  owes: 'You owe',
  available: (v: string): string => `${v} available`,
  usage: (p: number): string => `${p}% of the limit used`,
  cycle: (v: string): string => `${v} since the statement date`,
  month: (v: string): string => `${v} spent this month`,
  dueOn: (d: string): string => `Payment due ${d}`,
  archived: (n: number): string => `Archived wallets (${n})`,
  restore: 'Restore',
  delete: 'Delete',
  archive: 'Archive',
  cancel: 'Cancel',
  save: 'Save',
  create: 'Create',
  saved: 'Wallet saved',
  archivedOk: 'Wallet archived',
  restored: 'Wallet restored',
  deleted: 'Wallet deleted',
  fail: 'Could not save. Try again.',
  newTitle: 'New wallet',
  editTitle: 'Edit wallet',
  name: 'Name',
  namePh: 'E.g. Main checking',
  nameErr: 'Give the wallet a name',
  kind: 'Type',
  provider: 'Bank or provider',
  optional: 'Optional',
  last4: 'Last 4 digits',
  last4Help: 'Only to recognise it. Never type the full number.',
  last4Err: 'It takes 4 digits',
  color: 'Color',
  opening: 'Current balance',
  openingHelp: 'What is there today. The movements you log will change it.',
  openingCard: 'What you owe today',
  openingCardHelp: 'What you have already spent on the card. Leave 0 if it is paid off.',
  limit: 'Credit limit',
  cutoff: 'Statement day',
  due: 'Payment day',
  dayErr: 'A day between 1 and 31',
  numberErr: 'Enter a valid number',
  transferTitle: 'Transfer between wallets',
  transferNote: 'A transfer is neither income nor an expense. Paying off a credit card is a transfer into it.',
  from: 'From',
  to: 'To',
  amount: 'Amount',
  amountErr: 'Enter an amount greater than 0',
  sameErr: 'Pick two different wallets',
  date: 'Date',
  note: 'Note',
  doTransfer: 'Transfer',
  transferred: 'Transfer logged',
  recent: 'Recent transfers',
  undoTransfer: (label: string): string => `Undo transfer ${label}`,
  transferDeleted: 'Transfer undone',
};

const COPY: Copy<typeof es> = { es, en };

export const ACCOUNT_ICON: Record<AccountKind, LucideIcon> = { WALLET: Smartphone, BANK: Landmark, CREDIT_CARD: CreditCard, DEBIT_CARD: CreditCard, CASH: Banknote, ASSET: Gem };
const KINDS: AccountKind[] = ['WALLET', 'BANK', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'ASSET'];
const isCard = (kind: AccountKind) => kind === 'CREDIT_CARD' || kind === 'DEBIT_CARD';
const todayKey = () => new Date().toISOString().slice(0, 10);
/** Número con coma o punto. null: vacío; NaN: no es un número. */
const num = (text: string): number | null => {
  const clean = text.trim().replace(',', '.');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : NaN;
};
const day = (text: string) => { const n = num(text); return n === null ? null : Number.isInteger(n) && n >= 1 && n <= 31 ? n : NaN; };

type Money = (n: number) => string;

function AccountDialog({ open, account, preset, onClose, onChanged }: {
  open: boolean; account: FinanceAccount | null; preset: { name: string; kind: AccountKind } | null; onClose: () => void; onChanged: () => void;
}) {
  const t = useText(COPY);
  const locale = useLocale();
  const toast = useToast();
  const blank = () => ({
    name: account?.name ?? preset?.name ?? '', kind: (account?.kind ?? preset?.kind ?? 'WALLET') as AccountKind, provider: account?.provider ?? '',
    last4: account?.last4 ?? '', color: (account?.color ?? 'jade') as AccountColor, opening: account ? String(account.openingBalance) : '',
    limit: account?.creditLimit ? String(account.creditLimit) : '', cutoff: account?.cutoffDay ? String(account.cutoffDay) : '', due: account?.dueDay ? String(account.dueDay) : '',
  });
  const [form, setForm] = useState(blank);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setForm(blank()); setTried(false); } }, [open, account?.id, preset?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const credit = form.kind === 'CREDIT_CARD';
  const opening = num(form.opening);
  const limit = num(form.limit);
  const cutoff = day(form.cutoff);
  const due = day(form.due);
  const last4Bad = form.last4 !== '' && !/^\d{4}$/.test(form.last4);
  const bad = (n: number | null) => n !== null && (Number.isNaN(n) || n < 0);
  const valid = form.name.trim() !== '' && !last4Bad && !bad(opening) && (!credit || (!bad(limit) && !Number.isNaN(cutoff) && !Number.isNaN(due)));
  const covers = coversFor(locale);

  async function run(action: () => Promise<void>, ok: string) {
    setSaving(true);
    try { await action(); toast.success(ok); onChanged(); onClose(); }
    catch (err) { toast.error(api.walletMessage(err, t.fail)); }
    finally { setSaving(false); }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    const body = {
      name: form.name.trim(), kind: form.kind, provider: form.provider.trim() || null, last4: isCard(form.kind) && form.last4 ? form.last4 : null, color: form.color,
      openingBalance: opening ?? 0, ...(credit && { creditLimit: limit || null, cutoffDay: cutoff, dueDay: due }),
    };
    void run(() => (account ? api.updateAccount(account.id, body) : api.createAccount(body)), t.saved);
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={account ? t.editTitle : t.newTitle} className="md:max-w-[540px]">
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <Field label={t.name} error={tried && !form.name.trim() ? t.nameErr : undefined}>
          <Input data-autofocus value={form.name} maxLength={40} onChange={(e) => set('name', e.target.value)} placeholder={t.namePh} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface">{t.kind}</span>
          <ChipGroup label={t.kind} value={form.kind} onChange={(kind) => set('kind', kind)} options={KINDS.map((value) => ({ value, label: t.kinds[value], icon: ACCOUNT_ICON[value] }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.provider} help={t.optional}>
            <Input value={form.provider} maxLength={40} onChange={(e) => set('provider', e.target.value)} />
          </Field>
          {isCard(form.kind) && (
            <Field label={t.last4} help={t.last4Help} error={tried && last4Bad ? t.last4Err : undefined}>
              <Input inputMode="numeric" maxLength={4} value={form.last4} onChange={(e) => set('last4', e.target.value.replace(/\D/g, ''))} placeholder="1234" className="font-mono tabular-nums" />
            </Field>
          )}
        </div>
        <Field label={credit ? t.openingCard : t.opening} help={credit ? t.openingCardHelp : t.openingHelp} error={tried && bad(opening) ? t.numberErr : undefined}>
          <Input inputMode="decimal" value={form.opening} onChange={(e) => set('opening', e.target.value)} placeholder="0" className="text-heading-sm font-mono tabular-nums" />
        </Field>
        {credit && (
          <div className="grid grid-cols-3 gap-3">
            <Field label={t.limit} error={tried && bad(limit) ? t.numberErr : undefined}>
              <Input inputMode="decimal" value={form.limit} onChange={(e) => set('limit', e.target.value)} className="font-mono tabular-nums" />
            </Field>
            <Field label={t.cutoff} error={tried && Number.isNaN(cutoff) ? t.dayErr : undefined}>
              <Input inputMode="numeric" value={form.cutoff} onChange={(e) => set('cutoff', e.target.value)} placeholder="15" className="font-mono tabular-nums" />
            </Field>
            <Field label={t.due} error={tried && Number.isNaN(due) ? t.dayErr : undefined}>
              <Input inputMode="numeric" value={form.due} onChange={(e) => set('due', e.target.value)} placeholder="30" className="font-mono tabular-nums" />
            </Field>
          </div>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">{t.color}</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(covers) as AccountColor[]).map((c) => (
              <label key={c} className="relative cursor-pointer">
                <input type="radio" name="wallet-color" value={c} checked={form.color === c} onChange={() => set('color', c)} className="peer sr-only" />
                <span className={cn('block size-11 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-on-background peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-primary', covers[c].className)} />
                <span className="sr-only">{covers[c].label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1">
            {account && <Button variant="ghost" size="md" onClick={() => void run(() => api.updateAccount(account.id, { archived: true }), t.archivedOk)}><Archive aria-hidden className="size-4" strokeWidth={1.75} />{t.archive}</Button>}
            {account && <Button variant="ghost" size="md" className="text-error-text" onClick={() => void run(() => api.deleteAccount(account.id), t.deleted)}><Trash2 aria-hidden className="size-4" strokeWidth={1.75} />{t.delete}</Button>}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={onClose}>{t.cancel}</Button>
            <Button type="submit" size="md" loading={saving}>{account ? t.save : t.create}</Button>
          </div>
        </div>
      </form>
    </ResponsiveDialog>
  );
}

function TransferDialog({ open, accounts, money, onClose, onChanged }: { open: boolean; accounts: FinanceAccount[]; money: Money; onClose: () => void; onChanged: () => void }) {
  const t = useText(COPY);
  const locale = useLocale();
  const toast = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<FinanceTransfer[]>([]);

  const loadRecent = () => api.fetchTransfers().then((list) => setRecent(list.slice(0, 5))).catch(() => undefined);
  useEffect(() => {
    if (!open) return;
    setFrom(accounts[0]?.id ?? ''); setTo(accounts[1]?.id ?? ''); setAmount(''); setDate(todayKey()); setNote(''); setTried(false);
    void loadRecent();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = num(amount);
  const amountOk = value !== null && !Number.isNaN(value) && value > 0;
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!amountOk || !from || !to || from === to) return;
    setSaving(true);
    try {
      await api.createTransfer({ fromAccountId: from, toAccountId: to, amount: value!, date, note: note.trim() || undefined });
      toast.success(t.transferred);
      onChanged(); onClose();
    } catch (err) { toast.error(api.walletMessage(err, t.fail)); }
    finally { setSaving(false); }
  }

  async function undo(id: string) {
    try { await api.deleteTransfer(id); toast.success(t.transferDeleted); onChanged(); void loadRecent(); }
    catch (err) { toast.error(api.walletMessage(err, t.fail)); }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={t.transferTitle} className="md:max-w-[520px]">
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
        <p className="-mt-1 text-body-sm text-on-surface-light">{t.transferNote}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.from}>
            <Select value={from} onChange={(e) => setFrom(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          </Field>
          <Field label={t.to} error={tried && from === to ? t.sameErr : undefined}>
            <Select value={to} onChange={(e) => setTo(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.amount} error={tried && !amountOk ? t.amountErr : undefined}>
            <Input data-autofocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="text-heading-sm font-mono tabular-nums" />
          </Field>
          <Field label={t.date}><DatePicker value={date} max={todayKey()} onChange={setDate} /></Field>
        </div>
        <Field label={t.note} help={t.optional}><Input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" loading={saving}><ArrowLeftRight aria-hidden className="size-4" strokeWidth={1.75} />{t.doTransfer}</Button>
        </div>
        {recent.length > 0 && (
          <section aria-label={t.recent} className="flex flex-col border-t border-border pt-3">
            <h3 className="text-label-lg text-on-surface-light">{t.recent}</h3>
            <ul>
              {recent.map((tr) => {
                const label = `${nameOf(tr.fromAccountId)} → ${nameOf(tr.toAccountId)}`;
                return (
                  <li key={tr.id} className="flex min-h-12 items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-body-md">{label}</span>
                    <span className="text-body-sm text-on-surface-light">{new Date(`${tr.date.slice(0, 10)}T12:00:00`).toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'short' })}</span>
                    <span className="font-mono text-label-lg tabular-nums">{money(tr.amount)}</span>
                    <Button variant="icon" aria-label={t.undoTransfer(label)} className="hover:text-error-text" onClick={() => void undo(tr.id)}><Trash2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </form>
    </ResponsiveDialog>
  );
}

export function Wallets({ accounts, totals, selected, onSelect, money, compact, onChanged }: {
  accounts: FinanceAccount[];
  totals: WalletTotals;
  /** Cartera por la que se filtra la página (null: todas). */
  selected: string | null;
  onSelect: (id: string | null) => void;
  money: Money;
  compact: Money;
  /** Algo cambió (cartera o traslado): la página vuelve a pedir saldos y movimientos. */
  onChanged: () => void;
}) {
  const t = useText(COPY);
  const locale = useLocale();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ account: FinanceAccount | null; preset: { name: string; kind: AccountKind } | null } | null>(null);
  const [transfer, setTransfer] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const active = accounts.filter((a) => !a.archivedAt);
  const archived = accounts.filter((a) => a.archivedAt);
  const covers = coversFor(locale);
  const picked = active.find((a) => a.id === selected);

  async function act(action: () => Promise<void>, ok: string) {
    try { await action(); toast.success(ok); onChanged(); }
    catch (err) { toast.error(api.walletMessage(err, t.fail)); }
  }

  return (
    <section aria-labelledby="fin-wallets" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="fin-wallets" className="text-heading-sm md:text-heading-lg">{t.title}</h2>
          <p className="text-body-sm text-on-surface-light">{t.desc}</p>
        </div>
        <div className="flex gap-2">
          {active.length >= 2 && <Button variant="secondary" size="md" onClick={() => setTransfer(true)}><ArrowLeftRight aria-hidden className="size-4" strokeWidth={1.75} />{t.transfer}</Button>}
          <Button variant={active.length ? 'secondary' : 'primary'} size="md" onClick={() => setDialog({ account: null, preset: null })}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.add}</Button>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border-strong p-5">
          <p className="text-heading-sm">{t.emptyTitle}</p>
          <p className="max-w-[60ch] text-body-md text-on-surface-light">{t.emptyBody}</p>
          <div className="flex flex-wrap gap-2">
            {t.quick.map((q) => (
              <Button key={q.name} variant="secondary" size="sm" onClick={() => setDialog({ account: null, preset: q })}><Plus aria-hidden className="size-4" strokeWidth={2} />{q.name}</Button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-[auto_repeat(3,minmax(0,1fr))] sm:items-end">
            <div className="col-span-2 flex flex-col sm:col-span-1 sm:pr-6">
              <dt className="text-body-sm text-on-surface-light">{t.netWorth}</dt>
              <dd className={cn('font-mono text-display-sm tabular-nums md:text-display-md', totals.total < 0 ? 'text-error-text' : 'text-on-background')}><AnimatedValue value={totals.total} format={money} quietUnits /></dd>
            </div>
            {([[t.inWallets, totals.assets, ''], [t.owed, totals.debt, totals.debt > 0 ? 'text-warning-text' : ''], [t.unassigned, totals.unassigned, '']] as const).map(([label, value, tone]) => (
              <div key={label} className="flex flex-col">
                <dt className="text-body-sm text-on-surface-light">{label}</dt>
                <dd className={cn('font-mono text-heading-sm tabular-nums', tone)}>{compact(value)}</dd>
              </div>
            ))}
          </dl>

          <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-3 pt-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
            {active.map((a, i) => {
              const Icon = ACCOUNT_ICON[a.kind];
              const credit = a.kind === 'CREDIT_CARD';
              const on = selected === a.id;
              const owed = Math.max(0, -a.balance);
              const dueText = credit && a.dueDay ? t.dueOn(api.nextDueDate(a.dueDay).toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'short' }).replace('.', '')) : null;
              return (
                <motion.li
                  key={a.id} className="w-[78vw] max-w-[320px] shrink-0 snap-start md:w-auto md:max-w-none"
                  initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...heavy, delay: 0.05 + i * 0.06 }}
                >
                  {/* Tarjeta física: vidrio ahumado que se inclina con el cursor o el dedo (lib/motion/tilt). */}
                  <div className={cn('lq-smoke lq-lift relative flex aspect-[1.586] flex-col justify-between rounded-2xl p-4 transition-shadow', on && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg text-background', covers[a.color]?.className)}><Icon aria-hidden className="size-4" strokeWidth={1.75} /></span>
                        <span className="min-w-0">
                          <button type="button" aria-pressed={on} aria-label={on ? t.showingOnly(a.name) : t.showOnly(a.name)} onClick={() => onSelect(on ? null : a.id)} className="block max-w-full truncate text-left text-label-lg after:absolute after:inset-0 after:rounded-2xl after:content-['']">{a.name}</button>
                          <span className="block truncate text-body-sm text-on-surface-light">{a.provider || t.kinds[a.kind]}{a.last4 ? ` ·· ${a.last4}` : ''}</span>
                        </span>
                      </span>
                      <Button variant="icon" aria-label={t.editOf(a.name)} className="relative z-[1] -mr-2 -mt-2" onClick={() => setDialog({ account: a, preset: null })}><Pencil aria-hidden className="size-4" strokeWidth={1.75} /></Button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {credit && <span className="text-body-sm text-on-surface-light">{t.owes}</span>}
                      <span className={cn('font-mono text-heading-lg tabular-nums', !credit && a.balance < 0 && 'text-error-text')} title={money(credit ? owed : a.balance)}>
                        <AnimatedValue value={credit ? owed : a.balance} format={money} quietUnits />
                      </span>
                      {credit && a.usage !== null ? (
                        <>
                          <div role="meter" aria-label={t.usage(Math.round(a.usage * 100))} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(a.usage * 100))} className="h-1.5 overflow-hidden rounded-full bg-on-background/10">
                            <span className={cn('block h-full rounded-full', a.usage >= 0.9 ? 'bg-error' : a.usage >= 0.6 ? 'bg-warning' : 'bg-primary')} style={{ width: `${Math.min(100, a.usage * 100)}%` }} />
                          </div>
                          <span className="truncate text-body-sm text-on-surface-light">{[t.available(compact(a.available ?? 0)), dueText].filter(Boolean).join(' · ')}</span>
                        </>
                      ) : (
                        <span className="truncate text-body-sm text-on-surface-light">{credit ? [a.cycleSpent ? t.cycle(compact(a.cycleSpent)) : null, dueText].filter(Boolean).join(' · ') || t.kinds[a.kind] : t.month(compact(a.monthSpent))}</span>
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            {picked && <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>{t.showAll}</Button>}
            {totals.unassigned !== 0 && <p className="text-body-sm text-on-surface-light">{t.unassignedNote}</p>}
          </div>
        </>
      )}

      {archived.length > 0 && (
        <AccordionItem title={t.archived(archived.length)} open={showArchived} onToggle={() => setShowArchived((v) => !v)}>
          <ul className="flex flex-col">
            {archived.map((a) => (
              <li key={a.id} className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border py-1 last:border-0">
                <span className="min-w-0 flex-1 truncate text-body-md">{a.name}</span>
                <span className="font-mono text-body-sm tabular-nums text-on-surface-light">{compact(a.balance)}</span>
                <Button variant="ghost" size="sm" onClick={() => void act(() => api.updateAccount(a.id, { archived: false }), t.restored)}><RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />{t.restore}</Button>
                <Button variant="ghost" size="sm" className="text-error-text" onClick={() => void act(() => api.deleteAccount(a.id), t.deleted)}><Trash2 aria-hidden className="size-4" strokeWidth={1.75} />{t.delete}</Button>
              </li>
            ))}
          </ul>
        </AccordionItem>
      )}

      <AccountDialog open={dialog !== null} account={dialog?.account ?? null} preset={dialog?.preset ?? null} onClose={() => setDialog(null)} onChanged={onChanged} />
      <TransferDialog open={transfer} accounts={active} money={money} onClose={() => setTransfer(false)} onChanged={onChanged} />
    </section>
  );
}
