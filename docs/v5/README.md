# NoutLife v5 — plan de desarrollo y estado

Rama `feat/noutlife-v5` (desde `main` en `3383e4b`), integrada en `main` el 2026-11-14. Vercel despliega `main`: lee «Despliegue» antes de dar por buena la publicación.

La v5 amplía la app sin cambiar su esencia: calma, jade como acento, el aro del Modo enfoque. Todo lo nuevo
reutiliza el sistema de componentes (`components/ui/lq`), los textos `es`/`en` por pantalla y el patrón de la
API (rutas Express + servicios Prisma + esquemas zod). La lógica de cálculo vive en módulos puros con pruebas.

## Qué incluye

| # | Módulo | Estado | Dónde |
|---|--------|--------|-------|
| 1 | Zonas dinámicas: plantillas modulares | Hecho | `pages/CustomZones`, `components/zones/templates.ts` |
| 2 | Académico: notas, temas, entregas, promedios | Hecho | `components/learning/academic`, `lib/academic.ts`, API `/academic` |
| 3 | Recreación en minutos u horas + bienestar digital | Hecho | `components/recreation`, `pages/Recreation` |
| 4 | Finanzas multicartera (Nequi, bancos, tarjetas, efectivo) | Hecho | `components/finances/Wallets.tsx`, API `/finances/accounts`, `/finances/transfers` |
| 5 | Spotify dentro de la app, atado al Modo enfoque | Hecho (con límites) | `lib/spotify.ts`, `store/musicStore.ts`, `components/ui/MusicPlayer.tsx`, `FocusMode.tsx` |
| 6 | Oficina en la Libreta: documento, hoja, presentación + copiloto | Hecho (versión esencial) | `components/notebook/office`, `lib/sheet.ts`, API `/office` |
| 7 | 3D y movimiento | Hecho (sobre lo existente) | ver «Movimiento y 3D» |
| 8 | Funciones nuevas | Hecho (3) | ver «Funciones que no tiene otra app» |

## 1. Zonas dinámicas

- Cinco plantillas (Estudio, Trabajo, Salud, Finanzas, Creatividad). Crear desde una plantilla no usa IA, así
  que funciona aunque el cupo de IA esté agotado.
- Cada zona tiene **módulos**: enlaces a partes reales de la app (`/learning?tab=academico`, `/coliseo`,
  `/finances`, `/libreta?vista=oficina`…), el Modo enfoque o la música. La tarjeta de la zona los muestra como
  accesos.
- Los hábitos sugeridos (de la plantilla o del Sabio) ahora sí se crean al crear la zona; antes se ignoraban.
- El progreso de la zona sale de las misiones cumplidas. Antes la API solo devolvía las activas y el
  progreso era siempre 0 %.
- La API valida lo que llega al crear y editar (`custom-zones.routes.ts`); un módulo solo puede enlazar a una
  ruta interna.

## 2. Académico (pestaña de Aprendizaje, `?tab=academico`)

- Materias por periodo con créditos, escala (0–5, 0–10, 0–100 u otra), nota para aprobar y meta propia.
- Evaluaciones con tipo y peso. La API rechaza pesos que sumen más de 100 % y notas fuera de la escala.
- Temas con dominio en tres pasos (visto, practicado, dominado), enlazables a una evaluación.
- Compromisos con fecha (entregas, lecturas, trámites), con o sin materia.
- Todo se edita, archiva, restaura o elimina. Lo archivado se reúne al final de la pestaña.
- Cálculos (`lib/academic.ts`): promedio ponderado, nota que falta para aprobar y para la meta, promedio del
  periodo ponderado por créditos (con escalas mezcladas), estado de cada materia y «Dónde mejorar».
- Avisos: entregas a 3, 1 y 0 días; evaluaciones a 7, 3 y 1 días, con los temas sin practicar. Salen con la
  app abierta (`lib/reminderPlan.ts`), en Android (`lib/nativeNotifications.ts`) y por push desde el servidor
  (`smart-reminder.service.ts`), con la misma etiqueta para no repetirse.

## 3. Recreación

- La duración se anota en minutos u horas, con bloques de un toque (30 min a 4 h).
- Tarjeta de bienestar digital: ocio con pantalla frente a sin pantalla en 7 días, media diaria y el bloque
  más largo. Avisa con más de 3 h diarias de pantalla o si casi todo el descanso es pantalla.

## 4. Finanzas multicartera

- Carteras de seis tipos: billetera digital, cuenta bancaria, tarjeta de crédito, tarjeta débito, efectivo y
  otro activo. De la tarjeta solo se guardan los últimos 4 dígitos.
- El saldo no se guarda: sale del saldo inicial, los movimientos y los traslados (`api/src/lib/wallets.ts`).
  Una tarjeta de crédito muestra lo que se debe, el cupo usado, lo gastado desde el corte y el día de pago.
- Traslados entre carteras (pagar la tarjeta es un traslado hacia ella): no cuentan como ingreso ni gasto.
- Cada movimiento puede llevar su cartera. Tocar una cartera filtra toda la página por ella.
- Una cartera con movimientos no se borra: se archiva, para no cambiar los saldos de las demás.
- Arreglo incluido: `/finances/transactions` con `from` y `to` aplicaba solo `to`.

## 5. Spotify

- Reproductor incrustado de Spotify con once listas editoriales para enfocarse (Deep Focus, lofi beats,
  Peaceful Piano, Rain Sounds…). Los ids se comprobaron contra `open.spotify.com/oembed` el 2026-11-14.
- También suena la playlist de Ajustes o cualquier enlace pegado (lista, álbum, pódcast, episodio).
- El Modo enfoque arranca, pausa y detiene la música con el temporizador. El control usa los mensajes del
  reproductor incrustado (los mismos que envuelve la API de iframe oficial), sin cargar scripts de Spotify,
  así que la CSP no cambia (`frame-src` ya permitía `open.spotify.com`).
- **Límite:** sin sesión de Spotify en el navegador suenan avances de 30 s. El control completo (cola,
  volumen, pista actual) necesita el Web Playback SDK, una app registrada en Spotify y cuenta Premium.

## 6. Oficina en la Libreta (`/libreta?vista=oficina`)

- **Documento:** negrita, cursiva, subrayado, títulos, listas, deshacer. El HTML se sanea con la lista blanca
  de la Libreta. Pegar trae solo texto.
- **Hoja de cálculo:** hasta 26 columnas y 300 filas, barra de fórmulas, teclado de hoja de cálculo y
  gráfico de barras, línea o torta. Funciones en español o inglés: SUMA, PROMEDIO, MIN, MAX, CONTAR, SI,
  REDONDEAR, ABS; operadores aritméticos, `%`, `&`, comparaciones, referencias con `$`, errores (`#DIV/0!`,
  `#CICLO!`…). Motor puro en `lib/sheet.ts`.
- **Presentación:** cuatro diseños (portada, viñetas, cita, cifra), tres temas con colores de la marca y modo
  presentar a pantalla completa con transición 3D.
- **Copiloto** (IA, solo Pro, mismos límites que el Sabio): redacta, mejora lo seleccionado, resume, analiza
  la hoja (la recibe como CSV) y arma diapositivas desde notas. Nada cambia hasta que la persona inserta la
  propuesta. El contenido va marcado como material, no como instrucciones.
- Guardado automático a los 900 ms; sin conexión queda un borrador en el dispositivo que se sube al volver.
- **Límites:** sin exportar a .docx/.xlsx/.pptx, sin formato de celdas, insertar filas en medio no corre
  las referencias, y si dos dispositivos editan a la vez gana el último que guarda.

## 7. Movimiento y 3D

Sobre el motor existente (inclinación con muelle en `lib/motion/tilt`, vidrio de `depth.css`):

- Zonas: escribir la idea y revisar la propuesta giran como dos caras de una hoja; la página de la zona entra
  con un leve giro; las plantillas se inclinan con el cursor o el dedo.
- Presentaciones: transición espacial entre diapositivas y vista previa que se asienta en 3D.
- Carteras como tarjetas físicas de vidrio que se inclinan.
- Pronóstico con columnas de vidrio que suben con muelle.
- «Reducir movimiento» deja todo en fundidos.

No se añadieron escenas WebGL nuevas: las del Coliseo, Estadísticas y zonas siguen igual.

## 8. Funciones que no tiene otra app

1. **Pronóstico de tu semana** (Inicio, API `/pulse`): cuánto pesa cada uno de los próximos 7 días, como el
   pronóstico del tiempo. Junta evaluaciones y temas sin dominar, entregas, agenda, hábitos (con más peso el
   día de la semana en que se te suelen quedar), sueño atrasado y pagos (deudas, recibos, tarjetas). Da una
   sola sugerencia para aliviar el día más cargado. Reglas fijas en `api/src/lib/pulse.ts`; la app lo presenta
   como estimación.
2. **La banda sonora que te hace terminar** (Modo enfoque): cada sesión guarda con qué sonó y cuánto se
   propuso. Con 3 sesiones o más por sonido, la app recomienda con cuál cumples más (`rankSoundtracks`).
3. **¿Qué tan bien te conoces?** (Académico): antes de cada evaluación se anota la nota esperada. La app mide
   el sesgo (si esperas de más o de menos) y, con 3 predicciones, corrige lo que cabe esperar de la próxima.

## Modelo de datos

Migración `20261114120000_noutlife_v5`, espejada de forma idempotente en `api/src/lib/v5-migrations.ts`
(`V5_SQL`), que `migrate-db.ts` aplica en cada build. Se comprobó contra el DDL que genera Prisma
(`prisma migrate diff`): columnas, índices y claves foráneas coinciden.

| Tabla | Contenido |
|-------|-----------|
| `academic_courses` | Materia: periodo, créditos, escala, nota para aprobar, meta, archivado |
| `academic_grades` | Evaluación: tipo, peso, nota, predicción, fecha |
| `academic_topics` | Tema: dominio 0–3, evaluación opcional |
| `academic_tasks` | Compromiso con fecha, hecho o no |
| `finance_accounts` | Cartera: tipo, entidad, últimos 4, saldo inicial, cupo, corte, pago |
| `finance_transfers` | Traslado entre dos carteras |
| `office_files` | Documento, hoja o presentación (`content` JSON validado por tipo) |
| `transactions.accountId` | Cartera del movimiento (SET NULL al borrar la cartera) |
| `focus_sessions.plannedMin`, `soundtrack` | Lo propuesto y con qué sonó |

Todas tienen RLS activado. Reiniciar la cuenta las borra y la copia de datos las incluye.

## Endpoints nuevos

| Método y ruta | Plan |
|---------------|------|
| `GET /academic`; `POST/PATCH/DELETE /academic/courses`, `/grades`, `/topics`, `/tasks` | Pro (zona Aprendizaje) |
| `GET/POST/PATCH/DELETE /finances/accounts`; `GET/POST/DELETE /finances/transfers` | Pro (zona Finanzas) |
| `GET/POST /office`; `GET/PUT/DELETE /office/:id` | Todos |
| `POST /office/ai` | Pro (IA), con los límites del Sabio |
| `GET /pulse` | Todos (en Lite solo hábitos y agenda) |
| `POST /focus/complete` acepta `plannedMin` y `soundtrack`; `GET /focus/stats` devuelve `soundtracks` | Todos |

## Despliegue

Vercel despliega `noutlife` (web) y `noutlife-api` (API) desde `main`, a la vez. No hay orden: lo que cambia es la ventana entre los dos despliegues.

- La API corre `migrate-db.ts` en su build: crea las tablas y columnas nuevas (idempotente).
- Mientras la API vieja siga arriba: Pronóstico se oculta; Académico, Carteras y Oficina muestran su error con reintento (lo que ya existía no cambia); guardar una sesión de enfoque falla con 400, porque la API vieja rechaza `plannedMin` y `soundtrack`.
- Android recibe la web por OTA; no hace falta APK nueva.

## Pruebas

- API: `npm test` en `apps/api` (313 pruebas). Las nuevas están en `tests/v5.test.ts`: migración
  idempotente, saldos y cortes de tarjeta, pronóstico, banda sonora, reglas académicas y copiloto.
- Web: `npm test` en `apps/web` (192 pruebas). Nuevas: `academic.unit.ts`, `sheet.unit.ts`, `v5.unit.ts`.
- Revisión visual con la API simulada (Playwright, 390×844 y 1440×900, modo claro) de Inicio, Académico,
  Carteras, Recreación, Modo enfoque, Oficina (hoja, presentación, documento) y Zonas.

## Pendiente, en orden

1. Probar el copiloto con un proveedor de IA real (aquí solo se probaron el esquema y el análisis de la
   respuesta).
2. Revisar las pantallas nuevas en modo oscuro y con los temas de la Tienda.
3. Prueba de punta a punta con base de datos real: aplicar la migración en una base de prueba.
4. Darle al Sabio el contexto académico y de carteras (`life-context.service.ts`).
5. Exportar documentos, hojas y presentaciones (.docx, .xlsx, .pptx o PDF).
6. Lecturas sin conexión de Académico y Oficina (`lib/offline/policy.ts`).
7. Opcional: Web Playback SDK para control completo de Spotify (requiere app registrada y Premium).
