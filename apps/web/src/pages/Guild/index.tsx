import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Shield, Send, LogOut, Plus, Copy, Check } from 'lucide-react';
import {
  getMyGuild, createGuild, joinGuild, getGuildMessages, postGuildMessage, leaveGuild,
} from '../../services/social.service';
import { useAuthStore } from '../../store/authStore';
import { AvatarDisplay } from '../../components/character/AvatarDisplay';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { PixelButton } from '../../components/ui/PixelButton';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader-adapted';
import { useLoadingVisibility } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

interface GuildMemberUser {
  id: string;
  username: string;
  displayName: string;
  level: number;
  currentStreak: number;
  xp: number;
  avatarConfig?: unknown;
  avatarUrl?: string | null;
  equippedAura?: string | null;
  equippedFrame?: string | null;
  equippedHat?: string | null;
}

interface GuildMessageUser {
  id: string;
  username: string;
  displayName: string;
  avatarConfig?: unknown;
  avatarUrl?: string | null;
  equippedAura?: string | null;
  equippedFrame?: string | null;
}

interface GuildMessage {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  user: GuildMessageUser;
}

interface Guild {
  id: string;
  name: string;
  description?: string;
  emblem: string;
  leaderId: string;
  level: number;
  xp: number;
  inviteCode: string;
  members: Array<{
    id: string;
    userId: string;
    role: string;
    user: GuildMemberUser;
  }>;
}

const EMBLEMS = ['shield', 'sword', 'crown', 'star', 'dragon', 'wolf'];
const EMBLEM_ICONS: Record<string, string> = {
  shield: '🛡️', sword: '⚔️', crown: '👑', star: '⭐', dragon: '🐉', wolf: '🐺',
};

export default function GuildPage() {
  const { user } = useAuthStore();
  const [guild, setGuild] = useState<Guild | null>(null);
  const [messages, setMessages] = useState<GuildMessage[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'view' | 'create' | 'join'>('view');
  const [form, setForm] = useState({ name: '', description: '', emblem: 'shield' });
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const showLoading = useLoadingVisibility(loading);

  const load = () => {
    setLoading(true);
    getMyGuild().then((d) => setGuild(d as Guild | null)).catch(() => null).finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Poll messages every 5 seconds when in guild
  useEffect(() => {
    if (!guild) return;
    getGuildMessages(guild.id).then((d) => setMessages(d as GuildMessage[])).catch(() => null);
    const interval = setInterval(() => {
      getGuildMessages(guild.id).then((d) => setMessages(d as GuildMessage[])).catch(() => null);
    }, 5000);
    return () => clearInterval(interval);
  }, [guild?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await createGuild(form);
      setMode('view');
      load();
    } catch (e: unknown) { alert((e as Error).message); }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    try {
      await joinGuild(joinCode.trim());
      setMode('view');
      load();
    } catch (e: unknown) { alert((e as Error).message); }
  };

  const handleSendMessage = async () => {
    if (!msgInput.trim() || !guild) return;
    const content = msgInput.trim();
    setMsgInput('');
    try {
      const msg = await postGuildMessage(guild.id, content);
      setMessages((prev) => [...prev, msg as GuildMessage]);
    } catch (e: unknown) { alert((e as Error).message); }
  };

  const handleLeave = async () => {
    if (!guild || !confirm('¿Abandonar el gremio?')) return;
    try {
      await leaveGuild(guild.id);
      setGuild(null);
    } catch (e: unknown) { alert((e as Error).message); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(guild?.inviteCode ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (showLoading) {
    return <div className="py-6"><ModernLoader variant="compact" words={LOADING_COPY.guild} /></div>;
  }

  if (loading) return null;

  // No guild
  if (!guild && mode === 'view') {
    return (
      <div className="mx-auto flex min-h-[min(62vh,560px)] max-w-xl items-center px-4 py-8">
        <PixelPanel className="w-full overflow-hidden p-6 text-center shadow-md sm:p-9">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] text-[var(--accent-gold)] shadow-sm">
            <Shield size={31} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <p className="mt-5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Aún no tienes gremio</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">Crea un espacio con tu grupo o únete con un código de invitación para compartir el progreso.</p>

          <div className="mx-auto mt-6 grid max-w-sm gap-2.5 sm:grid-cols-2">
            <PixelButton variant="primary" onClick={() => setMode('create')} className="w-full">
              <span className="inline-flex items-center gap-2"><Plus size={15} aria-hidden="true" /> Crear gremio</span>
            </PixelButton>
            <PixelButton variant="ghost" onClick={() => setMode('join')} className="w-full">Unirse con código</PixelButton>
          </div>

          <div className="mt-6 border-t border-[var(--border-soft)] pt-4 text-xs text-[var(--text-muted)]">
            Puedes tener hasta 10 aventureros en un gremio.
          </div>
        </PixelPanel>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <PixelPanel className="p-5 shadow-md sm:p-6">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] text-[var(--accent-gold)]"><Shield size={18} aria-hidden="true" /></span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Crear gremio</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Reúne hasta diez aventureros alrededor de una misma meta.</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Nombre</span>
              <input
                placeholder="Nombre del gremio"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Descripción <span className="font-normal text-[var(--text-muted)]">(opcional)</span></span>
              <input
                placeholder="Una frase para tu equipo"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]"
              />
            </label>
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Emblema</legend>
              <div className="grid grid-cols-6 gap-2">
                {EMBLEMS.map((emblem) => {
                  const selected = form.emblem === emblem;
                  return (
                    <button
                      key={emblem}
                      type="button"
                      onClick={() => setForm({ ...form, emblem })}
                      aria-label={`Elegir emblema ${emblem}`}
                      aria-pressed={selected}
                      className={`flex h-11 items-center justify-center rounded-xl border text-xl transition-colors ${selected ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10' : 'border-[var(--border)] bg-[var(--bg-panel-light)] hover:border-[var(--border-strong)]'}`}
                    >
                      <E e={EMBLEM_ICONS[emblem]} />
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--border-soft)] pt-4">
              <PixelButton variant="ghost" onClick={() => setMode('view')} className="w-full">Cancelar</PixelButton>
              <PixelButton variant="primary" onClick={handleCreate} disabled={!form.name.trim()} className="w-full">Crear gremio</PixelButton>
            </div>
          </div>
        </PixelPanel>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <PixelPanel className="p-5 shadow-md sm:p-6">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] text-[var(--accent-gold)]"><Shield size={18} aria-hidden="true" /></span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Unirse a un gremio</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Pega el código de invitación que te compartió tu equipo.</p>
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Código de invitación</span>
            <input
              placeholder="ABC123"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5 text-center text-base font-semibold uppercase tracking-[0.22em] text-[var(--text-primary)] outline-none transition-colors placeholder:tracking-normal placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]"
            />
          </label>
          <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-[var(--border-soft)] pt-4">
            <PixelButton variant="ghost" onClick={() => setMode('view')} className="w-full">Cancelar</PixelButton>
            <PixelButton variant="primary" onClick={handleJoin} disabled={!joinCode.trim()} className="w-full">Unirse</PixelButton>
          </div>
        </PixelPanel>
      </div>
    );
  }

  if (!guild) return null;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      {/* Guild header */}
      <div className="bg-bg-panel border-4 border-border-pixel p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="text-4xl"><E e={EMBLEM_ICONS[guild.emblem] ?? '🛡️'} /></div>
          <div className="flex-1">
            <div className="font-pixel text-accent-gold" style={{ fontSize: '14px' }}>{guild.name}</div>
            {guild.description && <div className="font-vt text-text-dim text-sm mt-1">{guild.description}</div>}
            <div className="flex items-center gap-4 mt-2 font-vt text-xs text-text-dim">
              <span>Nv. {guild.level}</span>
              <span>{guild.members.length}/10 miembros</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-pixel text-text-dim" style={{ fontSize: '9px' }}>CÓDIGO:</span>
              <span className="font-pixel text-accent-gold" style={{ fontSize: '10px' }}>{guild.inviteCode}</span>
              <button onClick={copyCode} className="text-text-dim hover:text-accent-gold transition-colors">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <button
              onClick={handleLeave}
              className="flex items-center gap-1 px-2 py-1 border border-accent-crimson text-accent-crimson font-pixel hover:bg-accent-crimson hover:text-white transition-colors"
              style={{ fontSize: '8px' }}
            >
              <LogOut size={10} /> SALIR
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Members */}
        <div className="bg-bg-panel border-4 border-border-pixel p-3">
          <div className="font-pixel text-text-primary mb-3" style={{ fontSize: '10px' }}>MIEMBROS</div>
          <div className="space-y-2">
            {guild.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <AvatarDisplay
                  avatarConfig={m.user.avatarConfig}
                  avatarUrl={m.user.avatarUrl}
                  equippedAura={m.user.equippedAura}
                  equippedFrame={m.user.equippedFrame}
                  size={32}
                  animate="idle"
                />
                <div className="flex-1 min-w-0">
                  <div className={`font-pixel truncate ${m.userId === user?.id ? 'text-accent-gold' : 'text-text-primary'}`} style={{ fontSize: '8px' }}>
                    {m.user.displayName}
                    {m.role === 'LEADER' && <E e="👑" s={11} />}
                  </div>
                  <div className="font-vt text-text-dim" style={{ fontSize: '10px' }}>Nv.{m.user.level} · <E e="🔥" />{m.user.currentStreak}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="md:col-span-2 bg-bg-panel border-4 border-border-pixel flex flex-col" style={{ height: '400px' }}>
          <div className="font-pixel text-text-primary p-3 border-b-2 border-border-pixel" style={{ fontSize: '10px' }}>
            CHAT DEL GREMIO
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <div className="text-center py-4 font-vt text-text-dim text-sm">¡Sé el primero en hablar!</div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.userId === user?.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2 items-end ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    <AvatarDisplay
                      avatarConfig={msg.user.avatarConfig}
                      avatarUrl={msg.user.avatarUrl}
                      equippedAura={msg.user.equippedAura}
                      equippedFrame={msg.user.equippedFrame}
                      size={28}
                      animate="none"
                      className="flex-shrink-0 mb-4"
                    />
                    <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                      <span className="font-pixel text-text-dim" style={{ fontSize: '8px' }}>
                        {!isMe && msg.user.displayName}
                      </span>
                      <div className={`px-3 py-2 border-2 font-vt text-sm ${
                        isMe
                          ? 'bg-blue-900 border-blue-600 text-blue-100'
                          : 'bg-bg-deep border-border-pixel text-text-primary'
                      }`}>
                        {msg.content}
                      </div>
                      <span className="font-vt text-text-dim" style={{ fontSize: '10px' }}>
                        {new Date(msg.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t-2 border-border-pixel flex gap-2">
            <input
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Mensaje..."
              maxLength={500}
              className="flex-1 bg-bg-deep border-2 border-border-pixel px-3 py-2 font-vt text-sm text-text-primary focus:outline-none focus:border-accent-gold"
            />
            <button
              onClick={handleSendMessage}
              disabled={!msgInput.trim()}
              className="px-3 py-2 bg-accent-gold border-2 border-accent-gold text-bg-deep hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
