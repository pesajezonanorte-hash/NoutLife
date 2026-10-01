import { useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { getHeroLabel } from '../../utils/gender';
import { E } from '@/components/ui/glyphs';

interface Props {
  displayName: string;
  currentStreak: number;
  createdAt: string;
  gender?: 'male' | 'female';
  questsCompletedYesterday?: number;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function getMotivationalPhrase(
  firstName: string,
  streak: number,
  questsYesterday: number,
  daysSinceJoin: number,
  gender: 'male' | 'female' = 'male',
): string {
  const hero = getHeroLabel(gender);
  if (streak >= 30) return `${streak} días invicto, ${firstName}. Eres una leyenda.`;
  if (streak >= 14) return `${streak} días de racha, ${firstName}. El reino entero te observa.`;
  if (streak >= 7)  return `${streak} días imparables, ${firstName}. El fuego no se apaga.`;
  if (questsYesterday > 0) return `Ayer conquistaste el día, ${hero}. ¿Qué harás hoy?`;
  if (daysSinceJoin <= 3)  return `Bienvenido al mundo de LifeQuest, ${firstName}. Tu leyenda comienza.`;
  return `La aventura continúa, ${firstName}. ¿A qué esperas?`;
}

const DAYS_ES   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export function GreetingHeader({ displayName, currentStreak, createdAt, gender = 'male', questsCompletedYesterday = 0 }: Props) {
  const parallaxRef = useRef<HTMLDivElement>(null);

  // Parallax on scroll
  useEffect(() => {
    const main = parallaxRef.current?.closest('main');
    if (!main) return;
    const handleScroll = () => {
      if (parallaxRef.current) {
        parallaxRef.current.style.transform = `translateY(${main.scrollTop * 0.25}px)`;
      }
    };
    main.addEventListener('scroll', handleScroll, { passive: true });
    return () => main.removeEventListener('scroll', handleScroll);
  }, []);

  const { greeting, dateStr, daysSinceJoin, firstName, phrase } = useMemo(() => {
    const now   = new Date();
    const day   = DAYS_ES[now.getDay()];
    const date  = now.getDate();
    const month = MONTHS_ES[now.getMonth()];
    const join  = new Date(createdAt);
    const days  = Math.floor((now.getTime() - join.getTime()) / (1000 * 60 * 60 * 24));
    const first = displayName.split(' ')[0];
    return {
      greeting:      getGreeting(),
      dateStr:       `${day.charAt(0).toUpperCase() + day.slice(1)} ${date} de ${month}`,
      daysSinceJoin: days,
      firstName:     first,
      phrase:        getMotivationalPhrase(first, currentStreak, questsCompletedYesterday, days, gender),
    };
  }, [displayName, currentStreak, createdAt, questsCompletedYesterday, gender]);

  return (
    <div
      className="relative overflow-hidden mb-1"
      style={{
        borderRadius: 18,
        background: `
          radial-gradient(circle at 85% 20%, color-mix(in oklab, var(--text-primary) 4%, transparent), transparent 50%),
          radial-gradient(circle at 15% 80%, color-mix(in oklab, var(--text-primary) 5%, transparent), transparent 55%),
          linear-gradient(135deg, color-mix(in oklab, var(--text-primary) 3%, var(--surface)), var(--surface))
        `,
        border: '1px solid color-mix(in oklab, var(--text-primary) 10%, var(--border))',
        boxShadow: '0 18px 50px rgba(0,0,0,.18), 0 2px 4px rgba(0,0,0,.04)',
      }}
    >
      <div
        ref={parallaxRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.04) 0%, transparent 60%)',
          willChange: 'transform',
        }}
      />

      <motion.div
        className="relative flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>
            {greeting},
          </div>
          <h1
            className="m-0 truncate text-[28px] sm:text-[32px] font-extrabold tracking-[-0.03em] leading-[1.05]"
            style={{ color: 'var(--text)' }}
          >
            {firstName} <span style={{ color: 'var(--primary)' }}><E e="⚔" /></span>
          </h1>
          <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>
            {dateStr} · Día {daysSinceJoin} en LifeQuest
          </div>
          <motion.p
            className="mt-1 text-[14px] italic"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            style={{ color: 'var(--text-2)' }}
          >
            "{phrase}"
          </motion.p>
        </div>

        {currentStreak > 0 && (
          <motion.div
            className="flex items-center gap-2 self-start sm:self-center"
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              background: 'color-mix(in oklab, var(--c-amber) 14%, transparent)',
              border: '1px solid color-mix(in oklab, var(--c-amber) 28%, transparent)',
            }}
          >
            <motion.span
              className="text-xl"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <E e="🔥" />
            </motion.span>
            <div>
              <p
                className="font-medium"
                style={{ fontSize: 12, color: 'var(--c-amber)' }}
              >
                RACHA
              </p>
              <p className="text-[18px] font-extrabold tabular-nums leading-none mt-0.5" style={{ color: 'var(--text)' }}>
                {currentStreak} días
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
