// Textos de la portada en los dos idiomas. Tono: calma, minimalismo y claridad; el producto en el centro
// (rutina, mente e ideas en un solo lugar). Nada de videojuegos como gancho, ni números pequeños, ni urgencia.
// El precio se dice por día a partir de la oferta de quien mira (lib/offer): pesos en Colombia, dólares fuera.
import type { Copy } from '@/lib/locale';
import type { Offer } from '@/lib/offer';
import { TRIAL_DAYS } from '@/lib/plan';
import { LANDING_META } from '@/lib/seo-meta';

const es = {
  /** Título y descripción para Google: los mismos del HTML estático (lib/seo-meta). */
  meta: { title: LANDING_META.es.title, description: LANDING_META.es.description },
  /** Se escribe con la letra de la marca (Lettering): solo letras, comas y puntos. */
  headline: 'Tu rutina, tu mente y tus ideas. En un solo lugar.',
  subhead: 'Hábitos, libreta, obstáculos, bienestar y metas en un espacio que da gusto abrir todos los días.',
  start: 'Empieza gratis con Google',
  consent: { before: 'Al continuar con Google aceptas los', terms: 'Términos', and: 'y la', privacy: 'Política de privacidad', after: '.' },
  unavailable: 'El inicio de sesión no está disponible ahora mismo.',
  trialLine: (o: Offer) => `${TRIAL_DAYS} días de Pro incluidos, sin tarjeta. Después sigues gratis en Lite, o pasas a Pro desde unos ${o.perDay(o.perDayFor('year'), true)} al día.`,
  signInError: 'No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.',
  serverError: 'No se pudo conectar con el servidor. Inténtalo de nuevo.',
  googleError: 'No se pudo cargar el inicio de sesión de Google.',
  windowCaption: 'La ventana de Inicio sigue el cielo de tu hora.',
  pillarsTitle: 'Orden en calma, todos los días',
  pillars: [
    { name: 'Esencia', line: 'Un solo lugar para tu día.', body: 'Tus hábitos, tus ideas y tus metas viven juntos. Nada se queda en otra app.' },
    { name: 'Diseño', line: 'Calma en cada detalle.', body: 'Un modo oscuro cuidado, vidrio suave y una ventana con el cielo de tu hora.' },
    { name: 'Versatilidad', line: 'Del hábito a la idea sin cambiar de app.', body: 'Hábitos, libreta, obstáculos, bienestar y metas en un mismo espacio.' },
    { name: 'Intuitividad', line: 'Todo a un toque.', body: 'Marcas un hábito, anotas una idea o pospones un aviso sin buscar menús.' },
  ],
  faqTitle: 'Preguntas rápidas',
  faq: [
    { q: '¿Es gratis?', a: `Sí. NoutLife Lite es gratis para siempre, y los primeros ${TRIAL_DAYS} días tienes Pro completo.` },
    { q: '¿Me van a cobrar?', a: 'Solo si decides pasar a Pro. Para empezar no necesitas tarjeta, y si te suscribes cancelas con un clic.' },
    { q: '¿Funciona en iPhone?', a: 'Sí. Añádela a tu pantalla de inicio desde Safari para recibir los avisos.' },
    { q: '¿Mis datos?', a: 'Son tuyos. Puedes exportarlos cuando quieras desde Ajustes.' },
  ],
  pricingTitle: 'Lite gratis para siempre. Pro cuando lo quieras.',
  pricingDescription: (o: Offer) =>
    `Toda cuenta empieza con ${TRIAL_DAYS} días de Pro, sin tarjeta. El día ${TRIAL_DAYS + 1} sigues gratis en Lite sin perder nada, o pasas a Pro desde unos ${o.perDay(o.perDayFor('year'), true)} al día con el plan anual.`,
  startFree: 'Empieza gratis',
  startFreeNote: 'Sin tarjeta. Cancela en cualquier momento con 1 clic.',
  /** Enlace al otro idioma, escrito en ese idioma. */
  otherLanguage: { to: '/en', label: 'English', lang: 'en' },
};

const en: typeof es = {
  meta: { title: LANDING_META.en.title, description: LANDING_META.en.description },
  headline: 'Your routine, your mind, your ideas. In one calm place.',
  subhead: 'Habits, notebook, wellbeing and goals in a calm space you’ll look forward to opening every day.',
  start: 'Start free with Google',
  consent: { before: 'By continuing with Google, you agree to the', terms: 'Terms of Service', and: 'and', privacy: 'Privacy Policy', after: '.' },
  unavailable: 'Sign-in isn’t available right now.',
  trialLine: (o) => `${TRIAL_DAYS} days of Pro included, no card required. Then stay free on Lite, or go Pro from about ${o.perDay(o.perDayFor('year'), true)} a day.`,
  signInError: 'We couldn’t sign you in. Check your connection and try again.',
  serverError: 'We couldn’t reach the server. Please try again.',
  googleError: 'Google sign-in couldn’t load.',
  windowCaption: 'Your Home window follows the sky outside, hour by hour.',
  pillarsTitle: 'Calm, in order. Every day.',
  pillars: [
    { name: 'Essence', line: 'One place for your whole day.', body: 'Your habits, ideas and goals live together. Nothing gets lost in another app.' },
    { name: 'Design', line: 'Calm in every detail.', body: 'A refined dark mode, soft glass and a window that follows the sky of your hour.' },
    { name: 'Versatility', line: 'From habit to idea, without switching apps.', body: 'Habits, notebook, obstacles, wellbeing and goals in one fluid space.' },
    { name: 'Intuitive', line: 'Everything, one tap away.', body: 'Check off a habit, jot down an idea or snooze a reminder without digging through menus.' },
  ],
  faqTitle: 'Quick questions',
  faq: [
    { q: 'Is it free?', a: `Yes. NoutLife Lite is free forever, and your first ${TRIAL_DAYS} days include full Pro.` },
    { q: 'Will I be charged?', a: 'Only if you choose Pro. You don’t need a card to start, and if you subscribe you can cancel in one click.' },
    { q: 'Does it work on iPhone?', a: 'Yes. Add it to your Home Screen from Safari to get reminders.' },
    { q: 'What about my data?', a: 'It’s yours. Export it anytime from Settings.' },
    { q: 'Is the app in English?', a: 'The website, plans, checkout and legal pages are in English. Inside the app, English is rolling out screen by screen, so some screens are still in Spanish for now.' },
  ],
  pricingTitle: 'Lite, free forever. Pro, whenever you’re ready.',
  pricingDescription: (o) =>
    `Every account starts with ${TRIAL_DAYS} days of Pro, no card required. On day ${TRIAL_DAYS + 1} you stay free on Lite and keep everything, or go Pro from about ${o.perDay(o.perDayFor('year'), true)} a day with the annual plan.`,
  startFree: 'Start free',
  startFreeNote: 'No card required. Cancel anytime in 1 click.',
  otherLanguage: { to: '/es', label: 'Español', lang: 'es' },
};

export const LANDING: Copy<typeof es> = { es, en };
