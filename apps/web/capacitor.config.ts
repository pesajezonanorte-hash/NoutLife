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
    // Actualizaciones sin APK nuevo: las decide src/lib/ota.ts. Las direcciones vacías son a propósito: por
    // defecto el plugin mandaría datos del dispositivo a los servidores de Capgo.
    // keepUrlPathAfterReload: al recargar se sigue en la misma pantalla, también la que acaba de abrir un aviso.
    CapacitorUpdater: { autoUpdate: false, updateUrl: '', statsUrl: '', channelUrl: '', keepUrlPathAfterReload: true },
  },
};

export default config;
