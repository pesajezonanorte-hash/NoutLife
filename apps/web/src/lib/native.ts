// La app de Android (Capacitor, apps/web/android): esta misma web en un WebView, servida desde el teléfono.
// window.Capacitor lo inyecta el lado nativo antes de cargar la página; en la web no existe, y los módulos
// de Capacitor se importan bajo demanda solo aquí: el paquete de la web no carga con ellos.

type CapacitorGlobal = { isNativePlatform?: () => boolean };

export function isNativeApp(): boolean {
  return (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor?.isNativePlatform?.() === true;
}

/** En el teléfono no está el proxy de Vercel (vercel.json): se llama directamente a la API. */
export const NATIVE_API_BASE = 'https://lifequest2-api.vercel.app/api/v1';

interface GoogleSignInPlugin {
  signIn(options: { clientId: string }): Promise<{ idToken: string; displayName?: string }>;
}

let googleSignIn: GoogleSignInPlugin | undefined;

/**
 * Google no deja iniciar sesión dentro de un WebView: el acceso va por Credential Manager
 * (android/app/src/main/java/com/noutlife/app/GoogleSignInPlugin.java) y devuelve el mismo
 * ID token que el botón de la web. Si la persona cancela, el error trae code 'CANCELLED'.
 */
export async function nativeGoogleSignIn(clientId: string) {
  if (!googleSignIn) {
    const { registerPlugin } = await import('@capacitor/core');
    googleSignIn = registerPlugin<GoogleSignInPlugin>('GoogleSignIn');
  }
  return googleSignIn.signIn({ clientId });
}

/** Lo que el sistema hace por la app: el botón atrás y los iconos de la barra de estado según el tema. */
export async function startNativeShell() {
  const [{ App }, { SystemBars, SystemBarsStyle }] = await Promise.all([import('@capacitor/app'), import('@capacitor/core')]);

  // Con un oyente, Capacitor deja de navegar por su cuenta: atrás recorre el historial y, en la primera
  // pantalla, sale de la app como cualquier otra de Android. canGoBack ignora las pantallas de las que se
  // salió sin un toque (una redirección, p. ej.); el índice de React Router sí las cuenta.
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack || (window.history.state as { idx?: number } | null)?.idx) window.history.back();
    else void App.exitApp();
  });

  // Un tema de la app puede no coincidir con el del sistema: los iconos siguen a la clase de <html> (themeStore).
  // SystemBars nombra el fondo: Dark = fondo oscuro, iconos claros.
  const root = document.documentElement;
  const syncBars = () => void SystemBars.setStyle({ style: root.classList.contains('dark') ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
  new MutationObserver(syncBars).observe(root, { attributes: true, attributeFilter: ['class'] });
  syncBars();
}
