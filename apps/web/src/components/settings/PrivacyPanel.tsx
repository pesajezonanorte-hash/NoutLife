// Ajustes → Privacidad: biografía del perfil social, el color de tu nombre en
// las cartas y gremios, qué ven los demás (lista de amigos, perfil, en línea,
// zona actual y "visto") y las personas que bloqueaste.
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { apiError, getBlocked, getSocialSettings, unblockUser, updateSocialSettings, type Privacy, type PublicUser } from '@/services/network.service';
import { NAME_COLORS, nameClass } from '@/lib/nameColors';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { useVisitorPrefs } from '@/components/social/ZoneVisitors';
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
  const showWalkers = useVisitorPrefs((s) => s.show);
  const setShowWalkers = useVisitorPrefs((s) => s.setShow);
  const [privacy, setPrivacy] = useState<Privacy | null>(null);
  const [bio, setBio] = useState('');
  const [savedBio, setSavedBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Array<PublicUser & { blockedAt: string }> | null>(null);
  const displayName = useAuthStore((s) => s.user?.displayName) ?? 'Tu nombre';
  const updateUser = useAuthStore((s) => s.updateUser);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    getSocialSettings().then((s) => { setPrivacy(s.privacy); setBio(s.bio); setSavedBio(s.bio); setColor(s.nameColor); }).catch(() => toast.error('No se pudo cargar tu privacidad'));
    getBlocked().then(setBlocked).catch(() => setBlocked([]));
  }, [toast]);

  async function pickColor(next: string | null) {
    const before = color;
    setColor(next);
    try {
      const r = await updateSocialSettings({ nameColor: next });
      setColor(r.nameColor);
      if (user) updateUser({ ...user, nameColor: r.nameColor } as never);
    } catch (e) { setColor(before); toast.error(apiError(e, 'No se pudo guardar el color')); }
  }
  async function unblock(u: PublicUser) {
    setBlocked((l) => l?.filter((b) => b.id !== u.id) ?? l);
    try { await unblockUser(u.id); toast.info(`Desbloqueaste a ${u.displayName.split(' ')[0]}`, 'Puede volver a enviarte una paloma.'); }
    catch (e) { toast.error(apiError(e, 'No se pudo desbloquear')); getBlocked().then(setBlocked).catch(() => undefined); }
  }

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

      <Section eyebrow="En las cartas" title="El color de tu nombre" description="Así aparece tu nombre en los gremios y las cartas. Todos lo ven.">
        <div className="flex flex-col gap-4">
          <p className="lq-slip self-start px-4 py-2.5 text-body-lg">
            <span className={cn('block text-label-lg', nameClass(color) || 'text-on-surface')}>{displayName.split(' ')[0]}</span>
            ¡Hola a todos!
          </p>
          <div role="radiogroup" aria-label="Color del nombre" className="flex flex-wrap gap-2">
            <button type="button" role="radio" aria-checked={!color} onClick={() => void pickColor(null)}
              className={cn('flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-label-md', !color ? 'border-primary bg-primary/10 text-primary-text' : 'border-border text-on-surface')}>
              {!color && <Check aria-hidden className="size-4" />}Sin color
            </button>
            {NAME_COLORS.map((c) => (
              <button key={c.key} type="button" role="radio" aria-checked={color === c.key} aria-label={c.label} title={c.label} onClick={() => void pickColor(c.key)}
                className={cn('flex size-11 items-center justify-center rounded-full border-2 transition-transform active:scale-90', color === c.key ? 'border-on-background' : 'border-transparent')}>
                <span className={cn('flex size-8 items-center justify-center rounded-full bg-current', nameClass(c.key))}>
                  {color === c.key && <Check aria-hidden className="size-4 text-surface" strokeWidth={3} />}
                </span>
              </button>
            ))}
          </div>
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
            <Row id="pv-read" label="Confirmación de lectura" description="Tus amigos ven «Visto» cuando lees sus cartas." last>
              <Switch id="pv-read" checked={privacy.readReceipts} onChange={(e) => void change({ readReceipts: e.target.checked })} />
            </Row>
          </div>
        )}
      </Section>

      <Section eyebrow="Bloqueos" title="Personas bloqueadas" description="No pueden escribirte, enviarte palomas ni gestos, y no se ven en las zonas.">
        {blocked === null ? <Skeleton className="h-16 rounded-2xl" /> : blocked.length === 0 ? (
          <p className="text-body-md text-on-surface-light">No has bloqueado a nadie.</p>
        ) : (
          <ul className="flex flex-col">
            {blocked.map((u, i) => (
              <li key={u.id} className={cn('flex min-h-[64px] items-center gap-3 py-2', i < blocked.length - 1 && 'border-b border-border')}>
                <AvatarDisplay avatarConfig={u.avatarConfig} avatarUrl={u.avatarUrl} size={40} animate="none" className="overflow-hidden rounded-full" />
                <span className="min-w-0 flex-1"><span className="block truncate text-label-lg">{u.displayName}</span><span className="block truncate text-body-sm text-on-surface-light">@{u.username}</span></span>
                <Button size="sm" variant="secondary" onClick={() => void unblock(u)}>Desbloquear</Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section eyebrow="En las zonas" title="Amigos paseando" description="Cuando un amigo está en tu misma zona, su muñequito pasea por abajo y puedes saludarlo.">
        <Row id="pv-walkers" label="Ver a mis amigos en las zonas" description="Solo en este dispositivo. Para que no te vean a ti, apaga «Mostrar en qué zona estoy»." last>
          <Switch id="pv-walkers" checked={showWalkers} onChange={(e) => setShowWalkers(e.target.checked)} />
        </Row>
      </Section>
    </>
  );
}
