import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Sin esto, twMerge trataría `text-body-sm` (tamaño del rediseño) como un color
// y lo eliminaría al combinarlo con `text-on-surface`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{
        text: [
          'display-lg', 'display-md', 'display-sm', 'heading-lg', 'heading-md', 'heading-sm',
          'body-lg', 'body-md', 'body-sm', 'label-lg', 'label-md', 'caption',
        ],
      }],
    },
  },
});

/**
 * Helper estándar de shadcn/ui: combina clases con soporte de conflictos
 * de Tailwind (la última gana). Lo usan los componentes tipo shadcn
 * (flow-button, etc.) y los del rediseño (components/ui/lq).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
