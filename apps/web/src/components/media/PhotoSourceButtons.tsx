// Dos entradas de imagen: «Cámara» abre la cámara nativa (capture) en Android/iOS
// dentro de la PWA y «Galería» deja elegir una foto existente. Con un único input
// con `capture`, Android ya no ofrece la galería; sin él, algunas PWA no abren la cámara.
import { useRef } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/lq';

export function PhotoSourceButtons({
  onPick, facing = 'environment', loading, size = 'md', cameraLabel = 'Cámara', galleryLabel = 'Galería', accept = 'image/*', className,
}: {
  onPick: (file: File) => void;
  /** «user» abre la cámara frontal (selfies); «environment», la trasera. */
  facing?: 'user' | 'environment';
  loading?: boolean;
  size?: 'sm' | 'md';
  cameraLabel?: string;
  galleryLabel?: string;
  accept?: string;
  className?: string;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const take = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (file) onPick(file);
  };
  return (
    <div className={className ?? 'flex flex-wrap gap-2'}>
      <Button type="button" variant="secondary" size={size} loading={loading} onClick={() => cameraRef.current?.click()}>
        <Camera aria-hidden className="size-4" />{cameraLabel}
      </Button>
      <Button type="button" variant="ghost" size={size} disabled={loading} onClick={() => galleryRef.current?.click()}>
        <ImageIcon aria-hidden className="size-4" />{galleryLabel}
      </Button>
      <input ref={cameraRef} type="file" accept={accept} capture={facing} className="hidden" tabIndex={-1} aria-label={`${cameraLabel}: tomar foto`} onChange={(e) => take(e.currentTarget)} />
      <input ref={galleryRef} type="file" accept={accept} className="hidden" tabIndex={-1} aria-label={`${galleryLabel}: elegir foto`} onChange={(e) => take(e.currentTarget)} />
    </div>
  );
}
