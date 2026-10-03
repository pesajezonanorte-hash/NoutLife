// Registro — AuthLayout + nombre, usuario, email, contraseña (con medidor de
// seguridad 0–4) y confirmación. El cuerpo del avatar se elige aquí porque la
// API lo recibe como `gender`; el resto del avatar se completa en el onboarding.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import * as authService from '@/services/auth.service';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { Button, Field, Input, SegmentedControl } from '@/components/ui/lq';

const schema = z.object({
  displayName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(50, 'Máximo 50 caracteres'),
  username: z.string().trim().min(3, 'Mínimo 3 caracteres').max(20, 'Máximo 20 caracteres').regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guion bajo'),
  email: z.string().trim().min(1, 'Escribe tu email').email('Ese email no parece válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm: z.string().min(1, 'Repite la contraseña'),
}).refine((d) => d.password === d.confirm, { message: 'Las contraseñas no coinciden', path: ['confirm'] });

type FormData = z.infer<typeof schema>;

const STRENGTH = [
  { label: 'Muy débil', bar: 'bg-error', text: 'text-error-text' },
  { label: 'Débil', bar: 'bg-error', text: 'text-error-text' },
  { label: 'Aceptable', bar: 'bg-warning', text: 'text-warning-text' },
  { label: 'Buena', bar: 'bg-success', text: 'text-success-text' },
  { label: 'Fuerte', bar: 'bg-success', text: 'text-success-text' },
];

/** 0–4: longitud ≥ 8, mayús + minús, número, símbolo; ≥ 12 suma uno extra. */
function strength(p: string) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  if (p.length >= 12) s++;
  return Math.min(4, p.length < 8 ? Math.min(s, 1) : s);
}

function StrengthMeter({ password }: { password: string }) {
  const s = strength(password);
  const meta = STRENGTH[s];
  return (
    <div className="flex flex-col gap-1.5">
      <div aria-hidden className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-1.5 rounded-full transition-colors duration-200', password && i <= Math.max(1, s) ? meta.bar : 'bg-surface-variant')} />
        ))}
      </div>
      <p className="text-body-sm text-on-surface-light">
        {password ? <>Seguridad: <b className={meta.text}>{meta.label}</b>. </> : null}
        Usa 8 o más caracteres, mezcla mayúsculas, números y símbolos.
      </p>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [apiError, setApiError] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const password = useWatch({ control, name: 'password' }) ?? '';

  async function onSubmit(data: FormData) {
    setApiError('');
    try {
      const { user, accessToken } = await authService.register({
        email: data.email, username: data.username, password: data.password, displayName: data.displayName, gender,
      });
      setAuth(user, accessToken);
      navigate('/');
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      setApiError(d?.error || d?.message || 'No pudimos crear tu cuenta. Inténtalo de nuevo.');
    }
  }

  return (
    <AuthLayout
      title="Únete a la aventura"
      subtitle="Crea tu cuenta en un minuto. Después personalizas tu avatar."
      footer={<>¿Ya tienes cuenta? <Link to="/login" className="inline-flex min-h-11 items-center font-semibold text-primary-text underline-offset-4 hover:underline">Inicia sesión</Link></>}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Field label="Nombre" error={errors.displayName?.message}>
          <Input autoComplete="name" placeholder="Cómo quieres que te llamemos" {...register('displayName')} />
        </Field>
        <Field label="Usuario" help="Letras, números y guion bajo. Lo verán tus amigos." error={errors.username?.message}>
          <Input autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="alex_rivera" {...register('username')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" placeholder="tu@email.com" {...register('email')} />
        </Field>
        <div className="flex flex-col gap-2">
          <Field label="Contraseña" error={errors.password?.message}>
            <PasswordInput autoComplete="new-password" {...register('password')} />
          </Field>
          <StrengthMeter password={password} />
        </div>
        <Field label="Repite la contraseña" error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...register('confirm')} />
        </Field>
        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-label-lg text-on-surface">Tu personaje</span>
          <SegmentedControl
            role="radiogroup" label="Tu personaje" value={gender} onChange={setGender}
            options={[{ value: 'male', label: 'Héroe' }, { value: 'female', label: 'Heroína' }]}
          />
        </div>

        {apiError && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-error/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-error-text">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {apiError}
          </p>
        )}

        <Button type="submit" size="lg" block loading={isSubmitting}>Crear cuenta</Button>
      </form>
    </AuthLayout>
  );
}
