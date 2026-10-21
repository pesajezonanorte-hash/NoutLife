// Navegadores internos de redes sociales: Google no deja iniciar sesión dentro de ellos.
export type InAppBrowser = 'instagram' | 'facebook' | 'tiktok';

export function detectInAppBrowser(ua: string): InAppBrowser | null {
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(ua)) return 'facebook';
  if (/musical_ly|BytedanceWebview|TikTok|trill_/i.test(ua)) return 'tiktok';
  return null;
}

/** La misma URL abierta en Chrome (Android); si Chrome no está, vuelve a la URL normal. */
export function chromeIntent(href: string): string {
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}
