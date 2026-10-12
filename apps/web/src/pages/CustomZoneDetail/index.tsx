// Página propia de una zona personalizada (/zonas/:id). Las zonas que crea el
// usuario se registran en el router y en la navegación en tiempo de ejecución:
// se pueden fijar en la barra principal como cualquier zona del juego.
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { item } from '@/lib/motion';
import { ZoneShell } from '@/components/ambience';
import { PageHeader } from '@/components/layout/PageHeader';
import { usePageCrumb } from '@/store/shellStore';
import { ErrorState, PageLoader } from '@/components/ui/lq';
import { ZoneCard, type CustomZone } from '@/pages/CustomZones';

export default function CustomZoneDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [zone, setZone] = useState<CustomZone | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try { setZone((await api.get<CustomZone>(`/custom-zones/${encodeURIComponent(id)}`)).data); setState('ready'); }
    catch { setState('error'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  usePageCrumb(zone?.name ?? null);

  if (state === 'loading') return <PageLoader />;
  if (state === 'error' || !zone) return <ErrorState title="No encontramos esta zona" description="Puede que la hayas eliminado." onRetry={() => void load()} />;

  return (
    <ZoneShell zone="custom-zones" contentClassName="gap-6 md:gap-10">
      <PageHeader eyebrow="Mi zona" title={zone.name} description={zone.description ?? 'Tu zona personalizada, con sus hábitos, misiones y acciones.'}
        aside={<Link to="/custom-zones" className="inline-flex min-h-11 items-center gap-2 text-label-lg text-primary-text hover:underline"><ArrowLeft aria-hidden className="size-4" />Todas mis zonas</Link>} />
      <motion.div variants={item} className="mx-auto w-full max-w-xl">
        <ZoneCard zone={zone} defaultOpen onDeleted={() => navigate('/custom-zones', { replace: true })} />
      </motion.div>
    </ZoneShell>
  );
}
