// Ajustes → Privacidad: biografía del perfil social y qué ven los demás
// (lista de amigos, perfil, en línea, zona actual y "visto").
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { getSocialSettings, updateSocialSettings, type Privacy } from '@/services/network.service';
import { Button, Field, SegmentedControl, Skeleton, Switch, Textarea } from '@/components/ui/lq';

function Row({ id, label, description, children, last }: { id: string; label: string; description: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={cn('flex min-h-[76px] flex-wrap items-center gap-4 py-3', !last && 'border-b border-border')}>
      <div className="min-w-0 flex-[1_1_240px]"><label htmlFor={id} className="text-label-lg md:text-body-md md:font-semibold">{label}</label><p className="text-body-sm text-on-surface-light">{description}</p></div>
      {children}
    </div>
  );
}

export function PrivacyPanel({ Section }: { Section: (p: { eyebrow?: string; title: string; description?: string; children: ReactNode }) => JSX.Element }) {
  const toast = useToast();
  const username = useAuthStore((s) => s.user?.username);
  const [privacy, setPrivacy] = useState<Privacy | null>(null);
  const [bio, setBio] = useState('');
  const [savedBio, setSavedBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSocialSettings().then((s) => { setPrivacy(s.privacy); setBio(s.bio); setSavedBio(s.bio); }).catch(() => toast.error('No se pudo cargar tu privacidad'));
  }, [toast]);

  async function change(patch: Partial<Privacy>) {
    if (!privacy) return;
    const before = privacy;
    setPrivacy({ ...privacy, ...patch });
    try { setPrivacy((await updateSocialSettings({ privacy: patch })).privacy); }
    catch { setPrivacy(before); toast.error('No se pudo guardar el cambio'); }
  }
  async function saveBio() {
    setSaving(true);
    try { const r = await updateSocialSettings({ bio }); setBio(r.bio); setSavedBio(r.bio); toast.success('Biografía guardada'); }
    catch { toast.error('No se pudo guardar la biografía'); }
    finally { setSaving(false); }
  }

  return (
    <>
      <Section eyebrow="Tu perfil social" title="Lo que ven tus amigos" description="Tu apodo y tu foto vienen de tu perfil. Aquí eliges el resto.">
        <Field label="Biografía" help={`${bio.length}/160`}>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 160))} rows={3} placeholder="Corredor de madrugada, aprendiendo a cocinar." />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {username && <Link to={`/u/${encodeURIComponent(username)}`} className="text-body-sm text-primary-text underline-offset-4 hover:underline">Ver mi perfil como lo ven los demás</Link>}
          <Button size="md" loading={saving} disabled={bio === savedBio} onClick={() => void saveBio()}><Save aria-hidden className="size-4" strokeWidth={1.75} />Guardar biografía</Button>
        </div>
      </Section>

      <Section eyebrow="Privacidad" title="Quién ve qué" description="Los cambios se guardan al momento.">
        {!privacy ? <Skeleton className="h-64 rounded-2xl" /> : (
          <div className="flex flex-col">
            <Row id="pv-profile" label="Perfil completo" description="Tus hábitos, logros y gremios.">
              <div className="w-full max-w-[280px]">
                <SegmentedControl label="Perfil completo" value={privacy.profile} onChange={(v) => void change({ profile: v })} options={[{ value: 'public', label: 'Todos' }, { value: 'friends', label: 'Amigos' }]} />
              </div>
            </Row>
            <Row id="pv-friends" label="Lista de amigos" description="Tus amigos y tus amistades más cercanas.">
              <div className="w-full max-w-[320px]">
                <SegmentedControl label="Lista de amigos" value={privacy.friendsList} onChange={(v) => void change({ friendsList: v })} options={[{ value: 'public', label: 'Todos' }, { value: 'friends', label: 'Amigos' }, { value: 'private', label: 'Solo yo' }]} />
              </div>
            </Row>
            <Row id="pv-online" label="Mostrar si estoy en línea" description="Tus amigos ven el punto verde y tu última conexión.">
              <Switch id="pv-online" checked={privacy.showOnline} onChange={(e) => void change({ showOnline: e.target.checked })} />
            </Row>
            <Row id="pv-zone" label="Mostrar en qué zona estoy" description="Por ejemplo «En línea · en Gimnasio».">
              <Switch id="pv-zone" checked={privacy.showZone && privacy.showOnline} disabled={!privacy.showOnline} onChange={(e) => void change({ showZone: e.target.checked })} />
            </Row>
            <Row id="pv-read" label="Confirmación de lectura" description="Tus amigos ven «Visto» cuando lees sus mensajes y fotos." last>
              <Switch id="pv-read" checked={privacy.readReceipts} onChange={(e) => void change({ readReceipts: e.target.checked })} />
            </Row>
          </div>
        )}
      </Section>
    </>
  );
}
