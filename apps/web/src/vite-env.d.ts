/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_CROSS_ORIGIN?: string;
  readonly VITE_SITE_URL?: string;
  readonly NEXT_PUBLIC_SITE_URL?: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_VAPID_PUBLIC_KEY: string;
  /** PostHog (analítica del embudo). Sin ella no se envía nada. */
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
