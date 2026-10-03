import { useState, type ReactNode } from 'react';
import {
  AlertTriangle, Bell, BookOpen, CheckCircle2, Flag, Flame, Info, Plus, Settings, Sparkles, Trash2, Wallet, X, Check,
} from 'lucide-react';
import {
  Badge, BarChart, Button, Card, CheckButton, Confetti, EmptyState, ErrorState, Field, Heatmap, IconChip, Input,
  LineChart, Modal, PageLoader, ProgressBar, ProgressRing, SegmentedControl, Select, Sheet, StatCard, Switch, Tabs,
  Toast, useToast, type HeatLevel,
} from '@/components/ui/lq';

function Block({ title, spec, children }: { title: string; spec: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-heading-sm">{title}</h3>
        <code className="font-mono text-body-sm text-on-surface-light">{spec}</code>
      </div>
      {children}
    </section>
  );
}

const heat: HeatLevel[][] = Array.from({ length: 12 }, (_, w) =>
  Array.from({ length: 7 }, (_, d) => {
    const i = w * 7 + d;
    return ([3, 9, 17, 22, 30, 38, 41, 47, 55, 60, 66, 74].includes(i) ? 0 : [5, 12, 26, 33, 50, 69].includes(i) ? 1 : 2) as HeatLevel;
  }),
);

export function ComponentsDemo() {
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  const [tab, setTab] = useState<'all' | 'prog' | 'done'>('all');
  const [checks, setChecks] = useState([true, false]);
  const [modal, setModal] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [burst, setBurst] = useState(0);

  return (
    <div className="flex flex-col gap-12">
      <h2 className="text-heading-md">Componentes</h2>

      <Block title="Button" spec='<Button variant="primary|secondary|ghost|danger|icon" size="lg|md|sm"> · hover scale 1.02 + shadow-md 100 ms'>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary lg</Button>
          <Button size="md">Primary md</Button>
          <Button size="sm">Primary sm</Button>
          <Button loading size="md">Guardando</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger"><Trash2 aria-hidden className="size-4" />Eliminar</Button>
          <Button variant="icon" aria-label="Notificaciones"><Bell aria-hidden className="size-6" strokeWidth={1.75} /></Button>
          <Button variant="icon" aria-label="Ajustes (hover)" className="bg-surface-variant"><Settings aria-hidden className="size-6" strokeWidth={1.75} /></Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Default', ''],
            ['Hover', 'scale-[1.02] bg-primary-hover shadow-md'],
            ['Active', 'scale-[0.98]'],
          ].map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <Button size="md" className={cls}>Guardar</Button>
              <span className="text-body-sm text-on-surface-light">{name}</span>
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <Button size="md" disabled>Guardar</Button>
            <span className="text-body-sm text-on-surface-light">Disabled</span>
          </div>
        </div>
      </Block>

      <Block title="Card · StatCard" spec='<Card variant="base|elevated" interactive> rounded-2xl p-4 md:p-6 · lift −4 px + shadow-lg 200 ms'>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="flex flex-col gap-2"><span className="text-label-lg">Base</span><span className="text-body-sm text-on-surface-light">surface + border + shadow-sm</span></Card>
          <Card variant="elevated" interactive className="flex flex-col gap-2"><span className="text-label-lg">Elevated · interactive</span><span className="text-body-sm text-on-surface-light">Pasa el cursor</span></Card>
          <Card className="flex flex-col gap-2"><Badge variant="success" icon={Check} className="self-start">Hecho</Badge><span className="text-label-lg">Con badge</span></Card>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={CheckCircle2} tone="success" value="3/5" label="Hábitos hoy" to="/_ui" />
          <StatCard icon={Flag} tone="primary" value={2} label="Misiones activas" to="/_ui" />
          <StatCard icon={Wallet} tone="info" value={1240} format={(n) => `$${Math.round(n).toLocaleString('es-CO')}`} label="Saldo del mes" to="/_ui" />
          <StatCard icon={Flame} tone="warning" value={14} label="Días de racha" to="/_ui" />
        </div>
      </Block>

      <Block title="Badge · IconChip" spec='<Badge variant size="md|lg" icon> · siempre ícono + texto en estados'>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success" icon={Check}>Completado</Badge>
          <Badge variant="warning" icon={AlertTriangle}>HP bajo</Badge>
          <Badge variant="error" icon={X}>Derrota</Badge>
          <Badge variant="info" icon={Info}>Nuevo</Badge>
          <Badge variant="primary" icon={Sparkles}>+150 XP</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge size="lg" variant="success">Salud</Badge>
          <Badge size="lg" variant="info">Aprendizaje</Badge>
          <Badge size="lg" variant="warning">Finanzas</Badge>
          <Badge size="lg" variant="secondary">Mente</Badge>
          <Badge size="lg">Neutral</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(['primary', 'secondary', 'success', 'warning', 'error', 'info', 'muted'] as const).map((t) => (
            <IconChip key={t} icon={BookOpen} tone={t} />
          ))}
          <IconChip icon={BookOpen} tone="primary" size="lg" />
        </div>
      </Block>

      <Block title="Input · Select · Switch" spec='<Field label help error><Input /></Field> · 16 px · borde gray-500 · foco 3 px'>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre del hábito" help="Corto y concreto."><Input placeholder="Ej. Leer 20 páginas" /></Field>
          <Field label="Focus (fijado)"><Input defaultValue="Meditar 10 min" className="border-primary ring-[3px] ring-primary/25" /></Field>
          <Field label="Monto" error="Ingresa un monto mayor a 0"><Input type="number" defaultValue={-20} /></Field>
          <Field label="Frecuencia"><Select defaultValue="d"><option value="d">Diario</option><option value="w">Semanal</option></Select></Field>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-3 text-body-md"><Switch defaultChecked />Notificaciones</label>
          <label className="flex items-center gap-3 text-body-md"><Switch />Reducir movimiento</label>
          <label className="flex items-center gap-3 text-body-md text-on-surface-light"><Switch disabled />Deshabilitado</label>
        </div>
      </Block>

      <Block title="SegmentedControl · Tabs · CheckButton" spec="píldora layoutId (spring) · indicador 200 ms · flechas ←/→ · aria-pressed">
        <SegmentedControl
          label="Filtro" value={filter} onChange={setFilter} className="max-w-md"
          options={[{ value: 'all', label: 'Todos' }, { value: 'active', label: 'Activos' }, { value: 'done', label: 'Completados' }]}
        />
        <Tabs
          label="Estado" value={tab} onChange={setTab}
          options={[{ value: 'all', label: 'Todas' }, { value: 'prog', label: 'En progreso' }, { value: 'done', label: 'Completadas' }]}
        />
        <div className="flex gap-3">
          {checks.map((c, i) => (
            <CheckButton key={i} checked={c} name={`Hábito ${i + 1}`} onToggle={() => setChecks((s) => s.map((v, j) => (j === i ? !v : v)))} />
          ))}
        </div>
      </Block>

      <Block title="ProgressBar · ProgressRing" spec="scaleX 900 ms (delay 200) · shine · pathLength 1.3 s">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6">
          <div className="flex flex-col gap-3">
            <ProgressBar value={72} label="Experiencia" valueText="72%" />
            <ProgressBar value={100} tone="success" label="Hábitos" />
            <ProgressBar value={35} tone="warning" size="lg" label="Presupuesto" />
            <ProgressBar value={82} tone="error" size="lg" shine label="Vida" />
          </div>
          <ProgressRing value={72} label="Progreso"><span className="text-heading-sm tabular-nums">72%</span></ProgressRing>
        </div>
      </Block>

      <Block title="Charts" spec="<BarChart> rise + tooltip · <LineChart> draw + meta · <Heatmap> 12 semanas">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <BarChart
              label="Gastos diarios: lunes 42, martes 18, miércoles 96, jueves 30, viernes 128, sábado 64, domingo 34. Máximo el viernes."
              showValues formatValue={(v) => `$${v}`}
              data={[['L', 42], ['M', 18], ['X', 96], ['J', 30], ['V', 128], ['S', 64], ['D', 34]].map(([label, value]) => ({ label: label as string, value: value as number, highlight: value === 128 }))}
            />
          </Card>
          <Card>
            <LineChart
              label="Horas de sueño: 6,5; 6,8; 7,0; 6,2; 7,1; 7,4; 7,7. Tendencia al alza."
              min={5.5} max={8} goal={{ value: 7, label: 'Meta 7 h' }} dots
              data={[6.5, 6.8, 7, 6.2, 7.1, 7.4, 7.7].map((value, i) => ({ label: ['V', 'S', 'D', 'L', 'M', 'X', 'J'][i], value }))}
            />
          </Card>
        </div>
        <Card><Heatmap weeks={heat} label="Mapa de calor: 72 de 84 días completados en las últimas 12 semanas" /></Card>
      </Block>

      <Block title="Toast" spec="móvil bottom-center · desktop bottom-right · 4 s · role=status / alert">
        <div className="flex flex-col gap-3 md:max-w-md">
          <Toast type="success" message="Hábito completado · +10 XP" onClose={() => {}} />
          <Toast type="error" message="No se pudo guardar. Revisa tu conexión." onClose={() => {}} />
          <Toast type="warning" message="Tu HP está bajo: descansa antes de pelear." onClose={() => {}} />
          <Toast type="info" message="Nueva misión semanal disponible." onClose={() => {}} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="md" variant="secondary" onClick={() => toast.success('Hábito completado · +10 XP')}>Lanzar toast</Button>
          <Button size="md" variant="secondary" onClick={() => toast.error('No se pudo guardar.')}>Lanzar error</Button>
        </div>
      </Block>

      <Block title="Modal · Sheet · Confetti" spec='role="dialog" aria-modal · focus trap · Escape · scrim 200 ms · panel spring / sheet 300 ms'>
        <div className="flex flex-wrap gap-3">
          <Button size="md" onClick={() => setModal(true)}>Abrir modal</Button>
          <Button size="md" variant="secondary" onClick={() => setSheetOpen(true)}>Abrir sheet</Button>
          <Button size="md" variant="secondary" onClick={() => setBurst((b) => b + 1)}>Confeti</Button>
        </div>
        <Modal open={modal} onClose={() => setModal(false)} title="¿Completar misión?">
          <p className="text-body-md text-on-surface">Recibirás +300 XP y la misión pasará a Completadas.</p>
          <div className="flex justify-end gap-3">
            <Button size="md" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button size="md" onClick={() => setModal(false)}>Completar</Button>
          </div>
        </Modal>
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="¿Completar misión?">
          <p className="text-body-md text-on-surface">“Termina un curso en línea” pasará a Completadas y recibirás <b>+300 XP</b>.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setSheetOpen(false)}>Cancelar</Button>
            <Button onClick={() => setSheetOpen(false)}>Completar</Button>
          </div>
        </Sheet>
        {burst > 0 && <Confetti burst={burst} />}
      </Block>

      <Block title="EmptyState · ErrorState · PageLoader" spec="if (isLoading) <PageLoader/> · if (error) <ErrorState onRetry/> (auto-retry 5 s) · if (empty) <EmptyState/>">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card padding="none">
            <EmptyState
              icon={CheckCircle2} title="Crea tu primer hábito" description="Comienza con un objetivo pequeño."
              action={<Button><Plus aria-hidden className="size-4" />Nuevo hábito</Button>}
            />
          </Card>
          <Card padding="none"><ErrorState onRetry={() => {}} autoRetrySeconds={0} description="Reintentando en 5 s…" /></Card>
        </div>
        <Card><PageLoader /></Card>
      </Block>
    </div>
  );
}
