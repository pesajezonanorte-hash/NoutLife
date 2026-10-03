// Contraseña con botón Mostrar/Ocultar dentro del campo (44 px). Recibe las
// props que <Field> inyecta (id, aria-describedby, invalid) y las pasa al <Input>.
import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/lq';

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(function PasswordInput({ className, ...rest }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? 'text' : 'password'} className={`pr-14 ${className ?? ''}`} {...rest} />
      <button
        type="button"
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={show}
        onClick={() => setShow((s) => !s)}
        className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-on-surface-light hover:text-on-background"
      >
        {show ? <EyeOff aria-hidden className="size-5" strokeWidth={1.75} /> : <Eye aria-hidden className="size-5" strokeWidth={1.75} />}
      </button>
    </div>
  );
});
