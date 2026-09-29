import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import * as authService from '../../services/auth.service';
import { PixelButton } from '../../components/ui/PixelButton';
import { PixelInput } from '../../components/ui/PixelInput';
import { MiguelSprite } from '../../components/character/MiguelSprite';
import { E } from '@/components/ui/glyphs';

const schema = z.object({
  displayName: z.string().min(2, 'At least 2 characters').max(50),
  username: z.string().min(3, 'At least 3 characters').max(20).regex(/^[a-zA-Z0-9_]+$/, 'Use letters, numbers, and underscores only'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters'),
  confirm: z.string(),
}).refine((data) => data.password === data.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});

type FormData = z.infer<typeof schema>;

const HAIR_COLORS = ['#2c1810', '#f4c430', '#8b0000', '#1a1a1a', '#808080'];
const SHIRT_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [apiError, setApiError] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [hairColor, setHairColor] = useState('#2c1810');
  const [shirtColor, setShirtColor] = useState('#3b82f6');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setApiError('');
    try {
      const { user, accessToken } = await authService.register({
        email: data.email,
        username: data.username,
        password: data.password,
        displayName: data.displayName,
        gender,
      });
      setAuth(user, accessToken);
      navigate('/');
    } catch (err: unknown) {
      const responseData = (err as { response?: { data?: { error?: string; message?: string } } }).response?.data;
      const message = responseData?.error || responseData?.message;
      setApiError(message ?? 'We could not create your account. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl rounded-[28px] border border-[var(--border)] bg-[var(--bg-panel)] p-8 shadow-lg md:p-10"
        >
          <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-lg">
              <img src="/brand/lifequest-logo.png" alt="LifeQuest" className="h-11 w-11 rounded-2xl border border-[var(--border)] bg-white object-cover" />
              <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] text-[var(--text-primary)]">Crea a tu héroe</h1>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Configura tu identidad una vez y gestiona tus misiones, hábitos, gym y finanzas en un solo lugar.
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-3xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-5 py-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white">
                <MiguelSprite
                  size={64}
                  bodyType={gender}
                  hairStyle={gender === 'female' ? 'long' : 'short'}
                  hairColor={hairColor}
                  shirtColor={shirtColor}
                  animate="idle"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Vista Previa</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">Tú como aventurero</p>
                <p className="text-sm text-[var(--text-secondary)]">Perfil RPG minimalista</p>
              </div>
            </div>
          </div>

          <div className="mb-8 grid gap-4 rounded-3xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-[var(--text-muted)] mb-3">¿Eres héroe o heroína?</p>
              <div className="flex gap-3">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`flex-1 py-3 border-2 font-vt text-lg transition-colors rounded ${
                      gender === g
                        ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]'
                        : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)]'
                    }`}
                  >
                    {g === 'male' ? <><E e="⚔️" s={11} /> Héroe</> : <><E e="🗡️" s={11} /> Heroína</>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--text-muted)]">Color de cabello</p>
              <div className="mt-3 flex gap-2">
                {HAIR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setHairColor(color)}
                    className={[
                      'h-8 w-8 rounded-full border-2 transition-transform',
                      hairColor === color ? 'scale-110 border-[var(--text-primary)]' : 'border-white/0',
                    ].join(' ')}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--text-muted)]">Color de ropa</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SHIRT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setShirtColor(color)}
                    className={[
                      'h-8 w-8 rounded-full border-2 transition-transform',
                      shirtColor === color ? 'scale-110 border-[var(--text-primary)]' : 'border-white/0',
                    ].join(' ')}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <PixelInput
                label="Nombre para mostrar"
                placeholder="Miguel Ángel"
                icon={<Sparkles size={16} />}
                error={errors.displayName?.message}
                {...register('displayName')}
              />
            </div>

            <PixelInput
              label="Nombre de usuario"
              placeholder="miguel_hero"
              icon={<User size={16} />}
              error={errors.username?.message}
              {...register('username')}
            />

            <PixelInput
              label="Email"
              type="email"
              placeholder="miguel@lifequest.com"
              icon={<Mail size={16} />}
              error={errors.email?.message}
              autoComplete="email"
              {...register('email')}
            />

            <PixelInput
              label="Contraseña"
              type="password"
              placeholder="Ingresa una contraseña fuerte"
              icon={<Lock size={16} />}
              error={errors.password?.message}
              autoComplete="new-password"
              maxLength={128}
              {...register('password')}
            />

            <PixelInput
              label="Confirmar contraseña"
              type="password"
              placeholder="Repite la contraseña"
              icon={<Lock size={16} />}
              error={errors.confirm?.message}
              autoComplete="new-password"
              maxLength={128}
              {...register('confirm')}
            />

            {apiError && (
              <motion.div
                className="md:col-span-2 rounded-2xl border border-[var(--accent-red)] bg-red-50 px-3 py-2 text-sm text-[var(--accent-red)] dark:bg-red-950/20"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
              >
                {apiError}
              </motion.div>
            )}

            <div className="md:col-span-2 mt-2">
              <PixelButton
                type="submit"
                variant="primary"
                fullWidth
                loading={isSubmitting}
                size="lg"
              >
                {isSubmitting ? 'Invocando...' : 'Comenzar aventura'}
              </PixelButton>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" className="font-semibold text-[var(--accent-blue)] hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </motion.section>
      </div>
    </div>
  );
}
