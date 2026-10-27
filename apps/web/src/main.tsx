import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { PWAInstallBanner } from './components/ui/PWAInstallBanner';
// Aplica .dark/.light en <html> al importarse, antes del primer render (sin parpadeo).
import './store/themeStore';
import { useMotionStore } from './store/motionStore';
import { captureAttribution, track } from './lib/analytics';
import { isHalloween } from './lib/season';
import './styles/globals.css';

// Temporada (styles/halloween.css); index.html lo adelanta para el splash.
if (isHalloween()) document.documentElement.dataset.season = 'halloween';
else delete document.documentElement.dataset.season;

// Sensación de app: iOS hace zoom con dos dedos aunque el viewport lo prohíba, y
// mantener pulsado abre el menú del sistema. Ambos se cortan fuera de los campos
// donde se escribe (allí se puede seleccionar, copiar y pegar).
const EDITABLE = 'input, textarea, [contenteditable]:not([contenteditable="false"]), .lq-selectable';
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => {
  if (!(e.target instanceof Element && e.target.closest(EDITABLE))) e.preventDefault();
});

// Embudo: UTM y ref del primer toque, y la instalación de la PWA.
captureAttribution();
window.addEventListener('appinstalled', () => track('pwa_installed'));

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed silently — non-critical
    });
  });
}

/**
 * "Reducir movimiento" solo lo decide el ajuste de la app (Perfil y Ajustes).
 * La preferencia del sistema operativo (`prefers-reduced-motion`) NO apaga las
 * animaciones: con el ajuste desactivado Framer ignora el sistema ('never') y
 * las animaciones siguen activas en todos los equipos, también en PC.
 */
function Motion({ children }: { children: ReactNode }) {
  const reduce = useMotionStore((s) => s.reduce);
  return <MotionConfig reducedMotion={reduce ? 'always' : 'never'}>{children}</MotionConfig>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Motion>
      <BrowserRouter>
        <App />
        <PWAInstallBanner />
      </BrowserRouter>
    </Motion>
  </StrictMode>
);
