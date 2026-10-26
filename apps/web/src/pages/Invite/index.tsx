// Portada de invitación (plan v3, T9): /i/:username. Dice quién invita, guarda el invitador
// en este dispositivo y lleva a iniciar sesión. Sin el usuario válido, va a /login.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { BrandLockup } from '@/components/layout/Brand';
import { Lettering } from '@/components/layout/Lettering';
import { Button, PageLoader } from '@/components/ui/lq';
import { ease } from '@/lib/motion';
import { track } from '@/lib/analytics';
import { getInviter, storeReferral, type Inviter } from '@/services/referral.service';
import { TRIAL_DAYS } from '@/lib/plan';
import { useLocale, type Copy } from '@/lib/i18n';

const COPY: Copy<{ invited: (name: string) => string; tagline: string; start: string; trial: string }> = {
  es: {
    invited: (name) => `${name} te invitó a NoutLife`,
    tagline: 'Tu rutina, tu mente y tus ideas en un solo lugar.',
    start: 'Empezar con Google',
    trial: `${TRIAL_DAYS} días de Pro incluidos, sin tarjeta.`,
  },
  en: {
    invited: (name) => `${name} invited you to NoutLife`,
    tagline: 'Your routine, your mind and your ideas in one place.',
    start: 'Start with Google',
    trial: `${TRIAL_DAYS} days of Pro included, no card required.`,
  },
};

export default function InvitePage() {
  const locale = useLocale();
  const t = COPY[locale];
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const [inviter, setInviter] = useState<Inviter | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let active = true;
    getInviter(username)
      .then((found) => { if (active) { setInviter(found); setStatus('ready'); track('invite_viewed'); } })
      .catch(() => { if (active) setStatus('missing'); });
    return () => { active = false; };
  }, [username]);

  if (status === 'missing') return <Navigate to="/login" replace />;
  if (status === 'loading' || !inviter) return <PageLoader />;

  function start() {
    storeReferral(inviter!.username);
    track('invite_clicked');
    navigate('/login');
  }

  return (
    <div lang={locale} className="flex min-h-dvh flex-col bg-background text-on-background">
      <main id="main" className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center gap-8 px-4 py-10">
        <BrandLockup markSize={30} />
        <motion.section
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease } }}
          aria-labelledby="lq-invite-title" className="flex flex-col gap-4"
        >
          <h1 id="lq-invite-title" className="text-display-sm [text-wrap:balance]">
            <Lettering text={t.invited(inviter.displayName)} delay={0.15} />
          </h1>
          <p className="text-body-lg text-on-surface-light">{t.tagline}</p>
        </motion.section>
        <div className="flex flex-col gap-3">
          <Button size="lg" block onClick={start}>
            <Sparkles aria-hidden className="size-5" strokeWidth={1.75} />{t.start}
          </Button>
          <p className="text-center text-body-sm text-on-surface-light">{t.trial}</p>
        </div>
      </main>
    </div>
  );
}
