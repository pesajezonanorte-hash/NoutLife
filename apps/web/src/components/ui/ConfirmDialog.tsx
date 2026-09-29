import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { getOpenOrigin } from '@/lib/origin';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm, onCancel, danger = false }: Props) {
  useEscapeKey(onCancel);
  // Punto de apertura: de aquí crece la animación (desde donde se hizo click).
  const [origin] = useState(() => getOpenOrigin());

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Portal al body: fuera del contenedor de la página/HUD, así el backdrop
  // `fixed inset-0` cubre el viewport completo y nunca se recorta.
  return createPortal((
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      style={{ transformOrigin: origin }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop en capa aparte: su blur/dim nunca afecta al panel ni al HUD */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={onCancel}
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut', delay: 0.05 }}
        className="relative z-10 w-full max-w-sm space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="space-y-2">
          <p className="font-pixel text-[var(--text-primary)]" style={{ fontSize: '12px' }}>{title}</p>
          <p className="font-vt text-[var(--text-secondary)] text-base">{message}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 border-2 border-[var(--border)] px-3 py-2 font-pixel text-[var(--text-secondary)] hover:border-[var(--text-secondary)] transition-colors"
            style={{ fontSize: '12px' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 border-2 px-3 py-2 font-pixel transition-colors ${
              danger
                ? 'border-[var(--accent-red)] bg-[var(--accent-red)] text-white hover:brightness-110'
                : 'border-[var(--accent-gold)] bg-[var(--accent-gold)] text-[var(--bg-deep)] hover:brightness-110'
            }`}
            style={{ fontSize: '12px' }}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  ), document.body);
}
