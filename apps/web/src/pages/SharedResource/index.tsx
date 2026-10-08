import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, CheckCircle2, Circle, Link2, ListChecks, Target } from 'lucide-react';
import { BrandLockup } from '@/components/layout/Brand';
import { Badge, Button, Card, ErrorState, PageLoader } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { resolveShare, updateSharedResource, type SharedResource } from '@/services/share.service';

export default function SharedResourcePage() {
  const { code = '' } = useParams();
  const toast = useToast();
  const [result, setResult] = useState<SharedResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setResult(await resolveShare(code)); setFailed(false); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  }, [code]);
  useEffect(() => { void load(); }, [load]);

  async function update(id: string, payload: Record<string, unknown>) {
    setBusyId(id);
    try { await updateSharedResource(code, payload); await load(); toast.success('Cambio guardado'); }
    catch { toast.error('No se pudo guardar. Revisa si el enlace sigue activo.'); }
    finally { setBusyId(null); }
  }

  const editable = result?.permission === 'EDIT';
  const isChecklist = result?.resourceType === 'CHECKLIST';
  const resource = result?.resource;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-background sm:px-6 md:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <BrandLockup />
          <Link to="/login" className="text-label-lg text-primary-text hover:underline">Iniciar sesión</Link>
        </header>
        {loading ? <PageLoader label="Abriendo contenido compartido…" /> : failed || !result ? (
          <ErrorState title="Este enlace ya no está disponible" description="Puede haber sido desactivado por su dueño o el contenido ya no existir." onRetry={() => void load()} autoRetrySeconds={0} />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-label-lg text-primary-text"><Link2 aria-hidden className="size-4" />Contenido compartido</span>
              <h1 className="text-display-sm">{resource?.title}</h1>
              <p className="text-body-lg text-on-surface-light">{resource?.description || 'Una lista para organizarse mejor.'}</p>
              <div className="flex flex-wrap gap-2"><Badge variant={editable ? 'success' : 'neutral'}>{editable ? 'Puedes editar' : 'Solo lectura'}</Badge><Badge variant="neutral">{isChecklist ? 'Checklist' : 'Meta'}</Badge></div>
            </div>

            {result.resourceType === 'CHECKLIST' ? (
              <Card as="section" padding="lg" className="flex flex-col gap-4">
                <div className="flex items-center gap-2"><ListChecks aria-hidden className="size-5 text-primary-text" /><h2 className="text-heading-sm">{result.resource.category}</h2>{result.resource.isTemplate && <Badge variant="warning">Plantilla</Badge>}</div>
                <ul className="flex flex-col gap-2">
                  {result.resource.items.map((step) => (
                    <li key={step.id} className="flex items-center gap-3 rounded-xl bg-surface-variant/60 p-2">
                      {editable ? (
                        <button type="button" aria-pressed={step.isDone} aria-label={`${step.isDone ? 'Desmarcar' : 'Completar'} ${step.title}`} disabled={busyId === step.id} onClick={() => void update(step.id, { itemId: step.id, isDone: !step.isDone })} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
                          {step.isDone ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success-text" /> : <Circle aria-hidden className="size-5 shrink-0 text-on-surface-light" />}
                          <span className={step.isDone ? 'text-body-md text-on-surface-light line-through' : 'text-body-md'}>{step.title}</span>
                        </button>
                      ) : <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3">{step.isDone ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success-text" /> : <Circle aria-hidden className="size-5 shrink-0 text-on-surface-light" />}<span className={step.isDone ? 'text-body-md text-on-surface-light line-through' : 'text-body-md'}>{step.title}</span></div>}
                    </li>
                  ))}
                  {!result.resource.items.length && <li className="py-3 text-body-md text-on-surface-light">Esta lista aún no tiene pasos.</li>}
                </ul>
              </Card>
            ) : (
              <Card as="section" padding="lg" className="flex flex-col gap-5">
                <div className="flex items-center gap-3"><Target aria-hidden className="size-6 text-primary-text" /><div><h2 className="text-heading-sm">Progreso · {result.resource.progress}%</h2><p className="text-body-sm text-on-surface-light">{result.resource.category} · {result.resource.status === 'ACHIEVED' ? 'Lograda' : result.resource.status === 'PAUSED' ? 'En pausa' : 'Activa'}</p></div></div>
                {result.resource.why && <p className="text-body-md italic text-on-surface-light">“{result.resource.why}”</p>}
                <ul className="flex flex-col gap-2">
                  {result.resource.milestones.map((milestone) => (
                    <li key={milestone.id} className="flex min-h-12 items-center gap-3 rounded-xl bg-surface-variant/60 px-3">
                      {editable ? <button type="button" aria-pressed={milestone.isCompleted} disabled={busyId === milestone.id} onClick={() => void update(milestone.id, { milestoneId: milestone.id, isCompleted: !milestone.isCompleted })} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left">{milestone.isCompleted ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success-text" /> : <Circle aria-hidden className="size-5 shrink-0 text-on-surface-light" />}<span className={milestone.isCompleted ? 'text-body-md text-on-surface-light line-through' : 'text-body-md'}>{milestone.title}</span></button> : <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3">{milestone.isCompleted ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success-text" /> : <Circle aria-hidden className="size-5 shrink-0 text-on-surface-light" />}<span className={milestone.isCompleted ? 'text-body-md text-on-surface-light line-through' : 'text-body-md'}>{milestone.title}</span></div>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <p className="flex items-start gap-2 text-body-sm text-on-surface-light"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />{editable ? 'Los cambios quedan guardados en la lista original para todas las personas.' : 'Tienes acceso de solo lectura. Pídele al dueño un enlace con permiso de edición si necesitas colaborar.'}</p>
            <div className="flex justify-center"><Button variant="secondary" onClick={() => window.location.assign('/')}><Link2 aria-hidden className="size-4" />Ir a NoutLife</Button></div>
          </>
        )}
      </div>
    </main>
  );
}
