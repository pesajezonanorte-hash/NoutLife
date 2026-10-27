// Ajustes → Privacidad: biografía del perfil social, el color de tu nombre en
// las cartas y gremios, qué ven los demás (lista de amigos, perfil, en línea,
// zona actual y "visto") y las personas que bloqueaste.
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useText, type Copy } from '@/lib/i18n';
import { apiError, getBlocked, getSocialSettings, unblockUser, updateSocialSettings, type Privacy, type PublicUser } from '@/services/network.service';
import { NAME_COLORS, nameClass } from '@/lib/nameColors';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { useVisitorPrefs } from '@/components/social/ZoneVisitors';
import { Button, Field, SegmentedControl, Skeleton, Switch, Textarea } from '@/components/ui/lq';

const es = {
  loadFail: 'No se pudo cargar tu privacidad',
  colorFail: 'No se pudo guardar el color',
  unblocked: (name: string): string => `Desbloqueaste a ${name}`,
  unblockedBody: 'Puede volver a enviarte una paloma.',
  unblockFail: 'No se pudo desbloquear',
  changeFail: 'No se pudo guardar el cambio',
  bioSaved: 'Biografía guardada',
  bioFail: 'No se pudo guardar la biografía',
  eyebrowSocial: 'Tu perfil social',
  titleSocial: 'Lo que ven tus amigos',
  descSocial: 'Tu apodo y tu foto vienen de tu perfil. Aquí eliges el resto.',
  bio: 'Biografía',
  bioPh: 'Corredor de madrugada, aprendiendo a cocinar.',
  viewProfile: 'Ver mi perfil como lo ven los demás',
  saveBio: 'Guardar biografía',
  eyebrowLetters: 'En las cartas',
  titleColor: 'El color de tu nombre',
  descColor: 'Así aparece tu nombre en los gremios y las cartas. Todos lo ven.',
  fallbackName: 'Tu nombre',
  hello: '¡Hola a todos!',
  colorGroup: 'Color del nombre',
  noColor: 'Sin color',
  eyebrowPrivacy: 'Privacidad',
  titlePrivacy: 'Quién ve qué',
  descPrivacy: 'Los cambios se guardan al momento.',
  profile: 'Perfil completo',
  profileDesc: 'Tus hábitos, logros y gremios.',
  everyone: 'Todos',
  friends: 'Amigos',
  onlyMe: 'Solo yo',
  friendsList: 'Lista de amigos',
  friendsListDesc: 'Tus amigos y tus amistades más cercanas.',
  online: 'Mostrar si estoy en línea',
  onlineDesc: 'Tus amigos ven el punto verde y tu última conexión.',
  zone: 'Mostrar en qué zona estoy',
  zoneDesc: 'Por ejemplo «En línea · en Coliseo».',
  read: 'Confirmación de lectura',
  readDesc: 'Tus amigos ven «Visto» cuando lees sus cartas.',
  eyebrowBlocks: 'Bloqueos',
  titleBlocked: 'Personas bloqueadas',
  descBlocked: 'No pueden escribirte, enviarte palomas ni gestos, y no se ven en las zonas.',
  noBlocks: 'No has bloqueado a nadie.',
  unblock: 'Desbloquear',
  eyebrowZones: 'En las zonas',
  titleWalkers: 'Amigos paseando',
  descWalkers: 'Cuando un amigo está en tu misma zona, su muñequito pasea por abajo y puedes saludarlo.',
  walkers: 'Ver a mis amigos en las zonas',
  walkersDesc: 'Solo en este dispositivo. Para que no te vean a ti, apaga «Mostrar en qué zona estoy».',
};

const en: typeof es = {
  loadFail: 'Could not load your privacy settings',
  colorFail: 'Could not save the color',
  unblocked: (name: string): string => `You unblocked ${name}`,
  unblockedBody: 'They can send you a pigeon again.',
  unblockFail: 'Could not unblock',
  changeFail: 'Could not save the change',
  bioSaved: 'Biography saved',
  bioFail: 'Could not save the biography',
  eyebrowSocial: 'Your social profile',
  titleSocial: 'What your friends see',
  descSocial: 'Your nickname and photo come from your profile. Choose the rest here.',
  bio: 'Biography',
  bioPh: 'Early-morning runner, learning to cook.',
  viewProfile: 'See my profile the way others see it',
  saveBio: 'Save biography',
  eyebrowLetters: 'In letters',
  titleColor: 'Your name color',
  descColor: 'This is how your name shows in guilds and letters. Everyone sees it.',
  fallbackName: 'Your name',
  hello: 'Hi everyone!',
  colorGroup: 'Name color',
  noColor: 'No color',
  eyebrowPrivacy: 'Privacy',
  titlePrivacy: 'Who sees what',
  descPrivacy: 'Changes are saved right away.',
  profile: 'Full profile',
  profileDesc: 'Your habits, achievements and guilds.',
  everyone: 'Everyone',
  friends: 'Friends',
  onlyMe: 'Only me',
  friendsList: 'Friends list',
  friendsListDesc: 'Your friends and your closest friendships.',
  online: 'Show when I am online',
  onlineDesc: 'Your friends see the green dot and your last connection.',
  zone: 'Show which zone I am in',
  zoneDesc: 'For example “Online · in Coliseum”.',
  read: 'Read receipts',
  readDesc: 'Your friends see “Seen” when you read their letters.',
  eyebrowBlocks: 'Blocks',
  titleBlocked: 'Blocked people',
  descBlocked: 'They cannot write to you, send pigeons or gestures, and you do not see each other in the zones.',
  noBlocks: 'You have not blocked anyone.',
  unblock: 'Unblock',
  eyebrowZones: 'In the zones',
  titleWalkers: 'Friends walking around',
  descWalkers: 'When a friend is in your same zone, their little character walks along the bottom and you can say hi.',
  walkers: 'See my friends in the zones',
  walkersDesc: 'Only on this device. So they cannot see you, turn off “Show which zone I am in”.',
};

const COPY: Copy<typeof es> = { es, en };

function Row({ id, label, description, children, last }: { id: string; label: string; description: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={cn('flex min-h-[76px] flex-wrap items-center gap-4 py-3', !last && 'border-b border-border')}>
      <div className="min-w-0 flex-[1_1_240px]"><label htmlFor={id} className="text-label-lg md:text-body-md md:font-semibold">{label}</label><p className="text-body-sm text-on-surface-light">{description}</p></div>
      {children}
    </div>
  );
}

export function PrivacyPanel({ Section }: { Section: (p: { eyebrow?: string; title: string; description?: string; children: ReactNode }) => JSX.Element }) {
  const t = useText(COPY);
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
  const displayName = useAuthStore((s) => s.user?.displayName) ?? t.fallbackName;
  const updateUser = useAuthStore((s) => s.updateUser);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    getSocialSettings().then((s) => { setPrivacy(s.privacy); setBio(s.bio); setSavedBio(s.bio); setColor(s.nameColor); }).catch(() => toast.error(t.loadFail));
    getBlocked().then(setBlocked).catch(() => setBlocked([]));
  }, [toast, t]);

  async function pickColor(next: string | null) {
    const before = color;
    setColor(next);
    try {
      const r = await updateSocialSettings({ nameColor: next });
      setColor(r.nameColor);
      if (user) updateUser({ ...user, nameColor: r.nameColor } as never);
    } catch (e) { setColor(before); toast.error(apiError(e, t.colorFail)); }
  }
  async function unblock(u: PublicUser) {
    setBlocked((l) => l?.filter((b) => b.id !== u.id) ?? l);
    try { await unblockUser(u.id); toast.info(t.unblocked(u.displayName.split(' ')[0]), t.unblockedBody); }
    catch (e) { toast.error(apiError(e, t.unblockFail)); getBlocked().then(setBlocked).catch(() => undefined); }
  }

  async function change(patch: Partial<Privacy>) {
    if (!privacy) return;
    const before = privacy;
    setPrivacy({ ...privacy, ...patch });
    try { setPrivacy((await updateSocialSettings({ privacy: patch })).privacy); }
    catch { setPrivacy(before); toast.error(t.changeFail); }
  }
  async function saveBio() {
    setSaving(true);
    try { const r = await updateSocialSettings({ bio }); setBio(r.bio); setSavedBio(r.bio); toast.success(t.bioSaved); }
    catch { toast.error(t.bioFail); }
    finally { setSaving(false); }
  }

  return (
    <>
      <Section eyebrow={t.eyebrowSocial} title={t.titleSocial} description={t.descSocial}>
        <Field label={t.bio} help={`${bio.length}/160`}>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 160))} rows={3} placeholder={t.bioPh} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {username && <Link to={`/u/${encodeURIComponent(username)}`} className="text-body-sm text-primary-text underline-offset-4 hover:underline">{t.viewProfile}</Link>}
          <Button size="md" loading={saving} disabled={bio === savedBio} onClick={() => void saveBio()}><Save aria-hidden className="size-4" strokeWidth={1.75} />{t.saveBio}</Button>
        </div>
      </Section>

      <Section eyebrow={t.eyebrowLetters} title={t.titleColor} description={t.descColor}>
        <div className="flex flex-col gap-4">
          <p className="lq-slip self-start px-4 py-2.5 text-body-lg">
            <span className={cn('block text-label-lg', nameClass(color) || 'text-on-surface')}>{displayName.split(' ')[0]}</span>
            {t.hello}
          </p>
          <div role="radiogroup" aria-label={t.colorGroup} className="flex flex-wrap gap-2">
            <button type="button" role="radio" aria-checked={!color} onClick={() => void pickColor(null)}
              className={cn('flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-label-md', !color ? 'border-primary bg-primary/10 text-primary-text' : 'border-border text-on-surface')}>
              {!color && <Check aria-hidden className="size-4" />}{t.noColor}
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

      <Section eyebrow={t.eyebrowPrivacy} title={t.titlePrivacy} description={t.descPrivacy}>
        {!privacy ? <Skeleton className="h-64 rounded-2xl" /> : (
          <div className="flex flex-col">
            <Row id="pv-profile" label={t.profile} description={t.profileDesc}>
              <div className="w-full max-w-[280px]">
                <SegmentedControl label={t.profile} value={privacy.profile} onChange={(v) => void change({ profile: v })} options={[{ value: 'public', label: t.everyone }, { value: 'friends', label: t.friends }]} />
              </div>
            </Row>
            <Row id="pv-friends" label={t.friendsList} description={t.friendsListDesc}>
              <div className="w-full max-w-[320px]">
                <SegmentedControl label={t.friendsList} value={privacy.friendsList} onChange={(v) => void change({ friendsList: v })} options={[{ value: 'public', label: t.everyone }, { value: 'friends', label: t.friends }, { value: 'private', label: t.onlyMe }]} />
              </div>
            </Row>
            <Row id="pv-online" label={t.online} description={t.onlineDesc}>
              <Switch id="pv-online" checked={privacy.showOnline} onChange={(e) => void change({ showOnline: e.target.checked })} />
            </Row>
            <Row id="pv-zone" label={t.zone} description={t.zoneDesc}>
              <Switch id="pv-zone" checked={privacy.showZone && privacy.showOnline} disabled={!privacy.showOnline} onChange={(e) => void change({ showZone: e.target.checked })} />
            </Row>
            <Row id="pv-read" label={t.read} description={t.readDesc} last>
              <Switch id="pv-read" checked={privacy.readReceipts} onChange={(e) => void change({ readReceipts: e.target.checked })} />
            </Row>
          </div>
        )}
      </Section>

      <Section eyebrow={t.eyebrowBlocks} title={t.titleBlocked} description={t.descBlocked}>
        {blocked === null ? <Skeleton className="h-16 rounded-2xl" /> : blocked.length === 0 ? (
          <p className="text-body-md text-on-surface-light">{t.noBlocks}</p>
        ) : (
          <ul className="flex flex-col">
            {blocked.map((u, i) => (
              <li key={u.id} className={cn('flex min-h-[64px] items-center gap-3 py-2', i < blocked.length - 1 && 'border-b border-border')}>
                <AvatarDisplay avatarConfig={u.avatarConfig} avatarUrl={u.avatarUrl} size={40} animate="none" className="overflow-hidden rounded-full" />
                <span className="min-w-0 flex-1"><span className="block truncate text-label-lg">{u.displayName}</span><span className="block truncate text-body-sm text-on-surface-light">@{u.username}</span></span>
                <Button size="sm" variant="secondary" onClick={() => void unblock(u)}>{t.unblock}</Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section eyebrow={t.eyebrowZones} title={t.titleWalkers} description={t.descWalkers}>
        <Row id="pv-walkers" label={t.walkers} description={t.walkersDesc} last>
          <Switch id="pv-walkers" checked={showWalkers} onChange={(e) => setShowWalkers(e.target.checked)} />
        </Row>
      </Section>
    </>
  );
}
