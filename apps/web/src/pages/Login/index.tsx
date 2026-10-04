// Login — AuthLayout + formulario con validación (zod) junto a cada campo y
// error de la API en role="alert".
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Info } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import * as authService from '@/services/auth.service';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { Button, Field, Input } from '@/components/ui/lq';

const schema = z.object({
  email: z.string().trim().min(1, 'Escribe tu email').email('Ese email no parece válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [apiError, setApiError] = useState('');
  const [forgot, setForgot] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setApiError('');
    try {
      const { user, accessToken } = await authService.login(data);
      setAuth(user, accessToken);
      navigate('/');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setApiError(message ?? 'No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  return (
    <AuthLayout
      title="Vuelve al juego"
      subtitle="Inicia sesión para seguir con tus hábitos y misiones."
      footer={<>¿No tienes cuenta? <Link to="/register" className="inline-flex min-h-11 items-center font-semibold text-primary-text underline-offset-4 hover:underline">Regístrate</Link></>}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" placeholder="tu@email.com" {...register('email')} />
        </Field>
        <div className="flex flex-col gap-2">
          <Field label="Contraseña" error={errors.password?.message}>
            <PasswordInput autoComplete="current-password" {...register('password')} />
          </Field>
          <button
            type="button"
            aria-expanded={forgot}
            aria-controls="forgot-note"
            onClick={() => setForgot((f) => !f)}
            className="inline-flex min-h-11 items-center self-end text-label-lg text-primary-text underline-offset-4 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
          {/* TODO(api): no hay endpoint de restablecimiento de contraseña. */}
          {forgot && (
            <p id="forgot-note" className="flex items-start gap-2 rounded-xl bg-info/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-info-text">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
              Todavía no se puede restablecer desde la app. Contacta con el soporte de Noutlife indicando el email de tu cuenta.
            </p>
          )}
        </div>

        {apiError && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-error/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-error-text">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {apiError}
          </p>
        )}

        <Button type="submit" size="lg" block loading={isSubmitting}>Iniciar sesión</Button>
      </form>
    </AuthLayout>
  );
}
