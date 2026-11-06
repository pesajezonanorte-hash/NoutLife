// Vuelta al enlace de recompensa: quien abrió /claim sin sesión (o sin onboarding) guardó el token;
// en cuanto entra con la cuenta lista, se le lleva de vuelta para que lo canjee con un clic.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { readPendingReward } from '@/services/reward.service';

export function PendingReward() {
  const navigate = useNavigate();
  const ready = useAuthStore((s) => s.isAuthenticated && Boolean(s.user?.onboardingCompleted));
  useEffect(() => {
    if (!ready) return;
    const token = readPendingReward();
    // /claim borra el token al cargar con la sesión lista: nunca se repite.
    if (token) navigate(`/claim?token=${encodeURIComponent(token)}`, { replace: true });
  }, [ready, navigate]);
  return null;
}
