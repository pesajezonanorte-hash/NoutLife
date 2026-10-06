// Foto instantánea: marco blanco con el borde inferior ancho, pegada a la carta
// con un trozo de cinta y un poco ladeada. Al llegar una foto nueva se revela
// (sale oscura y aparece despacio, como la película instantánea). Mientras la foto
// llega se ve su miniatura borrosa en el mismo hueco (nada salta de sitio). La nota
// se escribe en el borde inferior con la letra de la marca si es corta.
import { forwardRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Lettering, canLetter } from '@/components/layout/Lettering';

export interface InstantPhotoProps {
  /** La foto (null mientras llega). */
  src: string | null;
  /** Miniatura diminuta que se ve borrosa mientras llega la foto. */
  thumb?: string | null;
  alt: string;
  caption?: string | null;
  /** Inclinación en grados. */
  tilt?: number;
  /** Revelarse al montarse (fotos que acaban de llegar). */
  develop?: boolean;
  tape?: boolean;
  /** Sello pequeño en la esquina (fotos de la galería). */
  badge?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export const InstantPhoto = forwardRef<HTMLElement, InstantPhotoProps>(function InstantPhoto(
  { src, thumb, alt, caption, tilt = 0, develop = false, tape = true, badge, className, style, children },
  ref,
) {
  const [loaded, setLoaded] = useState(false);
  const text = caption?.trim();
  const lettered = text && text.length <= 28 && canLetter(text);
  return (
    <figure ref={ref} className={cn('lq-print relative rounded-[3px] p-[6%] pb-[19%]', className)} style={{ rotate: `${tilt}deg`, ...style }}>
      {tape && <span aria-hidden="true" className="lq-photo-tape absolute -top-2.5 left-1/2 h-5 w-[34%] -translate-x-1/2 -rotate-3 rounded-[2px]" />}
      <div className="relative aspect-square overflow-hidden rounded-[2px] bg-jade-900">
        {thumb && !loaded && (
          <img src={thumb} alt="" aria-hidden="true" className="absolute inset-0 block size-full scale-110 object-cover blur-md" />
        )}
        {!thumb && !src && <span aria-hidden="true" className="lq-photo-wait absolute inset-0" />}
        {src && (
          <img
            src={src} alt={alt} loading="lazy" decoding="async" draggable={false} onLoad={() => setLoaded(true)}
            className={cn('relative block size-full select-none object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
          />
        )}
        {develop && (
          <>
            <span aria-hidden="true" className="lq-develop absolute inset-0" />
            <span aria-hidden="true" className="lq-develop-warm absolute inset-0" />
          </>
        )}
        {badge && <span className="absolute right-1.5 top-1.5">{badge}</span>}
      </div>
      {text && (
        <figcaption className="absolute inset-x-[6%] bottom-[2.5%] flex h-[14%] items-center justify-center overflow-hidden text-center text-body-md leading-tight">
          {lettered ? <Lettering text={text} draw={develop} delay={develop ? 1.2 : 0} /> : <span className="line-clamp-1 font-medium">{text}</span>}
        </figcaption>
      )}
      {children}
    </figure>
  );
});
