// Copia texto al portapapeles. La Clipboard API exige contexto seguro (https)
// y permiso; si no está o falla, se recurre a un <textarea> temporal con
// execCommand('copy'), que funciona en navegadores y webviews más viejos.
// Devuelve true solo si el texto quedó copiado.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Sin Clipboard API o sin permiso: se intenta el método clásico.
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    // Fuera de pantalla sin provocar scroll ni zoom en iOS.
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}
