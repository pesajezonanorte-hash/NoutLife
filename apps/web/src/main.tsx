import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { PWAInstallBanner } from './components/ui/PWAInstallBanner';
// Aplica .dark/.light en <html> al importarse, antes del primer render (sin parpadeo).
import './store/themeStore';
import { useMotionStore } from './store/motionStore';
import './styles/globals.css';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed silently — non-critical
    });
  });
}

/**
 * "Reducir movimiento" de la app apaga las animaciones. Si no está activo, se
 * animan siempre: las del sistema de diseño son cortas y de pocos píxeles, y los
 * bucles decorativos se apagan aparte con la preferencia del sistema (tokens.css).
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
