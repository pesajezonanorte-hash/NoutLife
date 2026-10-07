// Texto de las páginas legales públicas: /privacy, /terms y /copyright.

export const CONTACT_EMAIL = 'Noutlife@hotmail.com';
export const LEGAL_ENTITY = 'SIDPESAJE';

const CONTACT = `Contacto para avisos legales, soporte y solicitudes DMCA: ${CONTACT_EMAIL}. También puedes escribirnos desde Ayuda → Enviar comentarios dentro de la app.`;

export const LEGAL_UPDATED = '10 de octubre de 2026';

export type LegalSection = { h: string; p: string[] };

export const PRIVACY: LegalSection[] = [
  { h: 'Qué datos recopilamos', p: [
    'Cuenta: el identificador, el correo y el nombre que Google nos entrega al iniciar sesión, y los datos de perfil que tú completas (usuario, avatar, bio).',
    'Autenticación: Noutlife utiliza exclusivamente autenticación federada con Google (Google OAuth). No tenemos registro con correo y contraseña, y NO recopilamos, pedimos ni guardamos contraseñas de ningún tipo. Tu contraseña de Google la gestiona solo Google y nunca llega a Noutlife.',
    'Tras iniciar sesión guardamos únicamente un identificador de sesión propio, con huella (hash), para mantenerte dentro de la app.',
    'Lo que registras en la app: hábitos, misiones, agenda, diario, finanzas, comida, sueño, entrenamientos, peso, fotos de progreso, relaciones y demás zonas.',
    'Social: tu perfil público, amistades, gremios y las cartas que envías, con sus fotos, videos y stickers.',
    'Técnicos: la suscripción de avisos push de cada dispositivo, tu zona horaria e idioma, y la fecha de tu última actividad.',
  ] },
  { h: 'No vendemos tus datos', p: [
    'Noutlife NO vende, alquila ni cede tus datos personales a terceros, ni los usa para publicidad. Solo los compartimos con los proveedores técnicos indicados más abajo, que los tratan por nuestra cuenta para que la app funcione.',
  ] },
  { h: 'Datos sensibles', p: [
    'Algunas zonas guardan datos de salud y bienestar (sueño, peso, comida, entrenamiento, ánimo) y datos financieros. Los usamos solo para mostrarte tu progreso y darte consejos dentro de la app.',
  ] },
  { h: 'Para qué los usamos', p: [
    'Para que la app funcione: guardar tu progreso, calcular XP, rachas y estadísticas, y enviarte los avisos que activaste.',
    'El Sabio y las funciones de IA: cuando las usas, enviamos un resumen de los datos necesarios a nuestros proveedores de IA (Groq, Gemini de Google, OpenRouter y OpenAI) para generar la respuesta.',
    'Seguridad: limitar abusos, proteger cuentas y cumplir la ley.',
  ] },
  { h: 'Google Calendar', p: [
    'Si conectas Google Calendar, recibimos de Google un token de acceso que guardamos de forma segura. Lo usamos únicamente para prestar la función que activaste: sincronizar tus hábitos y eventos con tu calendario. Nunca lo usamos para otro fin ni lo compartimos.',
    'Puedes desconectar la integración desde Ajustes y revocar el acceso en la configuración de tu cuenta de Google en cualquier momento.',
  ] },
  { h: 'Procesamiento con inteligencia artificial (Groq, Gemini, OpenRouter y OpenAI)', p: [
    'Las funciones de IA de Noutlife (como el Sabio y las sugerencias) usan las API de Groq, Gemini (Google), OpenRouter y OpenAI para procesar tus consultas y el contexto necesario de tu cuenta.',
    'Los datos enviados a Groq, Gemini, OpenRouter y OpenAI se usan exclusivamente para ofrecerte las características de IA de Noutlife. No autorizamos su uso para entrenar modelos de terceros, y solo enviamos lo necesario para generar cada respuesta.',
    'Cada proveedor trata esos datos según sus propias condiciones de API y de privacidad.',
  ] },
  { h: 'Divulgación de la API de Google', p: [
    'El uso y la transferencia a cualquier otra app de la información recibida de las API de Google se ajustará a la Política de datos de usuario de los servicios de API de Google, incluidos los requisitos de uso limitado (Limited Use).',
    'En concreto: solo usamos los datos de Google para ofrecerte las funciones visibles de Noutlife; no los transferimos a terceros salvo que sea necesario para prestar esas funciones, cumplir la ley o proteger la seguridad; no los usamos para publicidad; y ninguna persona los lee salvo con tu consentimiento, por seguridad o por obligación legal.',
  ] },
  { h: 'Almacenamiento local (localStorage)', p: [
    'Usamos el almacenamiento local de tu navegador (localStorage), no cookies de seguimiento. Sirve para recordar que tu sesión está activa, tu tema visual (claro u oscuro), la preferencia de movimiento y avisos que ya viste.',
    'La sesión usa además una cookie técnica necesaria para renovar el acceso. No usamos cookies ni almacenamiento con fines publicitarios ni de analítica de terceros.',
    'Puedes borrar estos datos desde la configuración de tu navegador; tendrás que volver a iniciar sesión.',
  ] },
  { h: 'Quién más los ve', p: [
    'Otras personas solo ven lo que haces público o compartes con ellas, según tus ajustes de Privacidad. Las cartas solo las ven quienes participan en ellas.',
    'Proveedores técnicos: alojamiento de la app y la API (Vercel), base de datos (Supabase), IA (Groq, Google Gemini, OpenRouter y OpenAI), inicio de sesión y calendario (Google) y avisos push (el servicio de tu navegador).',
  ] },
  { h: 'Cuánto tiempo', p: [
    'Mientras tengas cuenta. Si la eliminas, borramos tus datos de forma permanente en ese momento; las copias de seguridad del proveedor se sobrescriben en su ciclo normal.',
  ] },
  { h: 'Tus derechos (Habeas Data / RGPD)', p: [
    'Puedes acceder a tus datos, corregirlos, oponerte a su tratamiento, exportarlos y eliminarlos.',
    'Exportación: en Ajustes → Datos puedes descargar una copia de tus datos.',
    'Eliminación total: en Ajustes → Datos puedes reiniciar tu cuenta o eliminarla para siempre, lo que borra tus datos.',
    'Para cualquier otra solicitud, escríbenos a Noutlife@hotmail.com o desde Ayuda → Enviar comentarios. Respondemos en un plazo máximo de 30 días.',
  ] },
  { h: 'Responsable y contacto', p: [
    'Responsable del tratamiento y entidad comercial de respaldo: SIDPESAJE.',
    CONTACT,
  ] },
  { h: 'Menores', p: [
    'Noutlife no está dirigida a menores de 13 años (16 en la Unión Europea). Si detectamos una cuenta de alguien menor, la eliminamos.',
  ] },
];

export const TERMS: LegalSection[] = [
  { h: 'Edad e idoneidad', p: [
    'Debes tener al menos 13 años (16 en la Unión Europea) y capacidad legal para aceptar estos términos. Si eres menor de edad en tu país, necesitas el permiso de tu madre, padre o tutor.',
    'Entras con Google. Eres responsable de lo que se hace con tu cuenta.',
  ] },
  { h: 'Reglas de conducta', p: [
    'Está estrictamente prohibido publicar, subir o enviar contenido ilícito: material sexual con menores, contenido de odio, acoso, amenazas, violencia, estafas, spam, malware o cualquier contenido que infrinja derechos de otras personas.',
    'No intentes acceder a cuentas ajenas, vulnerar la seguridad de la app ni usar la app para actividades ilegales.',
    'Puedes bloquear y denunciar a cualquier persona. Podemos retirar contenido y suspender o eliminar cuentas que incumplan estas reglas, sin aviso previo cuando sea grave.',
  ] },
  { h: 'Contenido generado por el usuario', p: [
    'Conservas el 100 % de los derechos de autor sobre tu contenido: videos, fotos, notas, diarios, cartas y todo lo que crees en la app.',
    'Noutlife solo recibe una licencia técnica, limitada, no exclusiva y revocable para alojar, procesar y mostrar ese contenido dentro de tu cuenta y a las personas que tú decidas, únicamente para hacer funcionar la app. No lo usamos para otros fines ni lo vendemos.',
    'La licencia termina cuando borras el contenido o tu cuenta, salvo copias de seguridad que se eliminan en su ciclo normal.',
    'Declaras que tienes derecho a subir lo que subes.',
  ] },
  { h: 'Servicios de terceros', p: [
    'Noutlife usa servicios de terceros como Google (inicio de sesión, Calendar y Gemini), Groq, OpenRouter, OpenAI, Supabase y Vercel. No controlamos su disponibilidad y no somos responsables de interrupciones, cambios o fallos de esos servicios. Su uso se rige además por sus propios términos.',
  ] },
  { h: 'Propiedad intelectual de Noutlife', p: [
    'La app, su diseño, marca y código son propiedad de sus creadores. Consulta los detalles y las prohibiciones en la página de Propiedad intelectual (/copyright).',
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
  { h: 'Entidad y contacto', p: [
    'SIDPESAJE actúa como entidad comercial de respaldo para efectos tributarios y legales de Noutlife.',
    CONTACT,
  ] },
];

export const COPYRIGHT: LegalSection[] = [
  { h: 'Titularidad exclusiva', p: [
    '«Noutlife», su logotipo, el diseño de interfaz y experiencia de usuario (UI/UX), el código fuente y la arquitectura de la base de datos son propiedad exclusiva de sus creadores. Todos los derechos reservados.',
    'Nada de lo anterior se licencia, cede ni se pone a disposición del público, salvo el uso normal de la app como usuario.',
  ] },
  { h: 'Protección de la metodología', p: [
    'La terminología y el sistema gamificado de Noutlife, incluida la organización de la vida en «Zones» (zonas), «Glowup», «Rituals» (rituales) y «Learning» (aprendizaje), así como la forma en que se combinan con XP, rachas, misiones y el Sabio, forman parte de la propiedad intelectual de Noutlife.',
    'No puedes usar esos nombres, ni su estructura y mecánicas combinadas, para identificar o describir un producto competidor o confundible con Noutlife.',
  ] },
  { h: 'Prohibición de clonación', p: [
    'Sin autorización previa y por escrito, queda expresamente prohibido:',
    'Realizar ingeniería inversa, descompilar o intentar obtener el código fuente o la estructura de la base de datos.',
    'Copiar o clonar el diseño visual y la experiencia (look and feel) de Noutlife, total o parcialmente.',
    'Extraer datos o contenido de forma automatizada (web scraping, bots, rastreadores) o masiva.',
    'Crear, publicar o distribuir aplicaciones derivadas, espejo o servicios que reproduzcan Noutlife.',
  ] },
  { h: 'Servicios de terceros', p: [
    'Google (incluidos Calendar y Gemini), Groq, OpenRouter, OpenAI y demás servicios que se integran en Noutlife son marcas y propiedad de sus respectivos dueños, y Noutlife no reclama derecho alguno sobre ellos.',
    'La arquitectura del ecosistema unificado que los reúne en una sola experiencia es exclusiva de Noutlife.',
  ] },
  { h: 'Entidad de respaldo', p: [
    'SIDPESAJE actúa como entidad corporativa y comercial de respaldo de Noutlife para efectos tributarios y legales. Esto no transfiere derechos: la propiedad intelectual, la marca, el diseño visual y el código de Noutlife corresponden en su totalidad a sus creadores originales.',
  ] },
  { h: 'Tu contenido', p: [
    'Lo que creas en la app es tuyo (ver Términos de uso). Estas reservas se aplican a Noutlife como producto, no a tu contenido personal.',
  ] },
  { h: 'Procedimiento DMCA', p: [
    'Si crees que algún contenido alojado en Noutlife infringe tus derechos de autor, envía un aviso a Noutlife@hotmail.com (o desde Ayuda → Enviar comentarios) con: (1) la identificación de la obra protegida; (2) dónde está el contenido infractor (enlace o descripción); (3) tus datos de contacto; (4) una declaración de buena fe de que el uso no está autorizado; y (5) una declaración, bajo pena de perjurio, de que la información es exacta y de que eres el titular o tienes autorización para actuar en su nombre, con tu firma.',
    'Revisaremos el aviso, retiraremos el contenido cuando proceda y podremos suspender las cuentas que infrinjan de forma reiterada. La persona afectada puede enviar una contranotificación.',
    CONTACT,
  ] },
];
