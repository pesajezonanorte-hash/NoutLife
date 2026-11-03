import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.noutlife.app',
  appName: 'NoutLife',
  webDir: 'dist',
  server: {
    // La web se sirve desde el propio teléfono, pero con el dominio real en vez de https://localhost:
    // la API solo acepta orígenes exactos (apps/api/src/lib/oauth.ts) y los enlaces para compartir
    // salen de location.origin. Consecuencia: nada de noutlife.site llega a la red dentro de la app.
    androidScheme: 'https',
    hostname: 'noutlife.site',
  },
  plugins: {
    // index.html ya pide viewport-fit=cover: decirlo aquí evita un salto del splash al cargar.
    SystemBars: { initialViewportFitValueHint: 'cover' },
    LocalNotifications: { smallIcon: 'ic_stat_noutlife', iconColor: '#2F7565' },
  },
};

export default config;
