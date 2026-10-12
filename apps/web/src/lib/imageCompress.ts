// Las fotos de la cámara del móvil pesan varios MB: se reducen a JPEG antes de
// subirlas para que quepan en el límite de la API (≈500 kB) sin pedir nada al usuario.

/** Comprime una imagen a JPEG y devuelve el base64 (sin el prefijo data:). */
export async function compressImageToBase64(file: File, { maxSide = 1400, maxBytes = 480 * 1024 } = {}): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo procesar la imagen.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('No se pudo comprimir la imagen.')), 'image/jpeg', Math.max(0.45, 0.84 - attempt * 0.07)));
      if (blob.size <= maxBytes) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo leer la imagen.'));
          reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
          reader.readAsDataURL(blob);
        });
        return dataUrl.split(',')[1] ?? '';
      }
      scale *= 0.78;
    }
    throw new Error('La foto no se pudo comprimir a menos de 500 KB.');
  } finally {
    bitmap.close();
  }
}
