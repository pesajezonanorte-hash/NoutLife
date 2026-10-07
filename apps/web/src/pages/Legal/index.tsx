// Política de privacidad (/privacy) y Términos de uso (/terms). Públicas: las
// enlazan el login, Ajustes y las fichas de las tiendas.
// TODO(legal): revisar con asesoría legal antes de publicar y añadir el
// responsable (nombre o razón social, país) y un email de contacto propio.
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BrandLockup } from '@/components/layout/Brand';
import { Button } from '@/components/ui/lq';

const UPDATED = '9 de octubre de 2026';

type Section = { h: string; p: string[] };

const PRIVACY: Section[] = [
  { h: 'Qué datos guardamos', p: [
    'Cuenta: el identificador, el email y el nombre que Google nos entrega al iniciar sesión. No guardamos contraseñas.',
    'Lo que registras en la app: hábitos, misiones, agenda, diario, finanzas, comida, sueño, entrenamientos, peso, fotos de progreso, relaciones y demás zonas.',
    'Social: tu perfil público (usuario, nombre, avatar, nivel, bio), amistades, gremios y las cartas que envías, con sus fotos, videos y stickers.',
    'Técnicos: la suscripción de avisos push de cada dispositivo, tu zona horaria e idioma, y la fecha de tu última actividad.',
  ] },
  { h: 'Datos sensibles', p: [
    'Algunas zonas guardan datos de salud y bienestar (sueño, peso, comida, entrenamiento, ánimo) y datos financieros. Los usamos solo para mostrarte tu progreso y darte consejos dentro de la app. Nunca los vendemos ni los usamos para publicidad.',
  ] },
  { h: 'Para qué los usamos', p: [
    'Para que la app funcione: guardar tu progreso, calcular XP, rachas y estadísticas, y enviarte los avisos que activaste.',
    'El Sabio: cuando le preguntas, enviamos un resumen de tus datos a nuestro proveedor de IA (Google Gemini) para generar la respuesta. No se usan para entrenar modelos públicos según sus condiciones de API.',
    'Seguridad: limitar abusos, proteger cuentas y cumplir la ley.',
  ] },
  { h: 'Quién más los ve', p: [
    'Otras personas solo ven lo que haces público o compartes con ellas, según tus ajustes de Privacidad. Las cartas solo las ven quienes participan en ellas.',
    'Proveedores que tratan datos por nuestra cuenta: alojamiento de la app y la API (Vercel), base de datos (Supabase), IA (Google), inicio de sesión (Google) y avisos push (el servicio de tu navegador).',
  ] },
  { h: 'Cuánto tiempo', p: [
    'Mientras tengas cuenta. Si la eliminas, borramos tus datos de forma permanente en ese momento; las copias de seguridad del proveedor se sobrescriben en su ciclo normal.',
  ] },
  { h: 'Tus derechos', p: [
    'Desde Ajustes → Datos puedes descargar una copia de tus datos, reiniciar tu cuenta o eliminarla para siempre.',
    'También puedes pedirnos acceso, corrección u oposición escribiendo desde Ayuda → Enviar comentarios. Respondemos en un plazo máximo de 30 días.',
  ] },
  { h: 'Menores', p: [
    'Noutlife no está dirigida a menores de 13 años (16 en la Unión Europea). Si detectamos una cuenta de alguien menor, la eliminamos.',
  ] },
];

const TERMS: Section[] = [
  { h: 'Tu cuenta', p: [
    'Entras con Google. Eres responsable de lo que se hace con tu cuenta y debes tener al menos 13 años (16 en la Unión Europea).',
  ] },
  { h: 'Uso aceptable', p: [
    'No publiques ni envíes contenido ilegal, sexual con menores, de odio, acoso, amenazas, spam o que infrinja derechos de otros.',
    'Puedes bloquear y denunciar a cualquier persona. Podemos retirar contenido y suspender cuentas que incumplan estas reglas.',
  ] },
  { h: 'Tu contenido', p: [
    'Lo que creas sigue siendo tuyo. Nos das permiso para guardarlo y mostrarlo a quien tú decidas, solo para hacer funcionar la app.',
  ] },
  { h: 'Oro, tienda y recompensas', p: [
    'El oro, la XP y los objetos de la tienda son virtuales, no tienen valor monetario y no se pueden canjear por dinero.',
  ] },
  { h: 'Salud y finanzas', p: [
    'Noutlife y el Sabio dan información general y motivación. No son consejo médico, psicológico, nutricional ni financiero. Ante cualquier duda, consulta a un profesional.',
  ] },
  { h: 'Disponibilidad y responsabilidad', p: [
    'Ofrecemos la app tal cual y podemos cambiarla o interrumpir funciones. En la medida que permita la ley, no respondemos de daños indirectos derivados de su uso.',
  ] },
  { h: 'Fin de la relación', p: [
    'Puedes eliminar tu cuenta cuando quieras desde Ajustes. Si cambiamos estos términos de forma importante, te avisaremos en la app.',
  ] },
];

export default function LegalPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const privacy = pathname.startsWith('/privacy');
  const sections = privacy ? PRIVACY : TERMS;
  const title = privacy ? 'Política de privacidad' : 'Términos de uso';

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-on-background md:py-12">
      <article className="mx-auto flex max-w-[720px] flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <BrandLockup />
          <Button variant="ghost" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
            <ArrowLeft aria-hidden className="size-5" strokeWidth={1.75} />Volver
          </Button>
        </div>
        <header className="flex flex-col gap-1">
          <h1 className="text-display-sm">{title}</h1>
          <p className="text-body-sm text-on-surface-light">Última actualización: {UPDATED}</p>
        </header>
        {sections.map((s) => (
          <section key={s.h} className="flex flex-col gap-2">
            <h2 className="text-heading-md">{s.h}</h2>
            {s.p.map((t) => <p key={t} className="text-body-lg text-on-surface">{t}</p>)}
          </section>
        ))}
        <p className="text-body-sm text-on-surface-light">
          {privacy ? <>Lee también los <Link to="/terms" className="text-primary-text underline">Términos de uso</Link>.</> : <>Lee también la <Link to="/privacy" className="text-primary-text underline">Política de privacidad</Link>.</>}
        </p>
      </article>
    </main>
  );
}
