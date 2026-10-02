import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import * as authService from '@/services/auth.service';

const SAGE_SEEN_KEY = 'sage-daily-seen';

/** Abre la paleta de comandos (escucha Ctrl/⌘+K en window). */
export function openCommandPalette() {
  window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k', bubbles: true }));
}

/** ¿Hay consejo del Sabio sin ver hoy? (punto indicador en el botón). */
export function sageHasNew() {
  try { return localStorage.getItem(SAGE_SEEN_KEY) !== new Date().toDateString(); } catch { return false; }
}

/** Acciones compartidas por Topbar, menú móvil y opciones. */
export function useShellActions() {
  const navigate = useNavigate();
  const storeLogout = useAuthStore((s) => s.logout);
  const openSageStore = useUIStore((s) => s.openSage);

  async function logout() {
    try { await authService.logout(); } catch { /* sesión ya inválida */ }
    storeLogout();
    navigate('/login');
  }

  function openSage(message?: string) {
    openSageStore(message);
    try { localStorage.setItem(SAGE_SEEN_KEY, new Date().toDateString()); } catch { /* sin storage */ }
  }

  return { logout, openSage };
}
