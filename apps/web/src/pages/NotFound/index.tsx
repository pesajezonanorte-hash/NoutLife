import { FlowButton } from '@/components/ui/flow-button';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { E } from '@/components/ui/glyphs';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-deep)] text-[var(--text-primary)] p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md space-y-6"
      >
        <div className="text-7xl"><E e="🗺" /></div>
        <h1 className="text-3xl font-bold">Zona inexplorada</h1>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
          Esta parte del reino aún no ha sido descubierta. Puede que la URL sea incorrecta o que la zona haya sido movida.
        </p>
        <div className="text-5xl font-bold text-[var(--text-muted)] opacity-30">404</div>
        <div className="flex gap-3 justify-center">
          <FlowButton
            tone="ghost"
            withArrows={false}
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 text-sm"
          >
            ← Volver
          </FlowButton>
          <FlowButton
            tone="primary"
            withArrows={false}
            onClick={() => navigate('/')}
            className="px-4 py-2.5 text-sm"
          >
            <E e="🏰" /> Ir al Castillo
          </FlowButton>
        </div>
      </motion.div>
    </div>
  );
}
