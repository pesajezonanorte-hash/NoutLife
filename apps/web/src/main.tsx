import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { PWAInstallBanner } from './components/ui/PWAInstallBanner';
// Aplica .dark/.light en <html> al importarse, antes del primer render (sin parpadeo).
import './store/themeStore';
import './styles/globals.css';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed silently — non-critical
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <App />
        <PWAInstallBanner />
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>
);
