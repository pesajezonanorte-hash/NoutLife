// Personalizar avatar — ResponsiveDialog (modal md+, hoja en móvil) con tres
// pestañas: Pixel, Foto y Skin de Minecraft. La lógica de guardado es la de
// antes; cambia la presentación (lq) y el editor pixel compartido.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { lockScroll, unlockScroll } from '@/components/ui/lq/Modal';
import { Link as LinkIcon, Box, Camera, Check, Crop, Trash2, Upload, X } from 'lucide-react';
import { MinecraftSkinAvatar } from './MinecraftSkinAvatar';
import { PhotoCropper } from './PhotoCropper';
import { AvatarPreview, AvatarStudio } from './AvatarPixelEditor';
import { withDefaults } from './avatarOptions';
import { updateAvatar, updateProfile } from '../../services/user.service';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import type { AvatarConfig, AvatarMode } from '@noutlife/shared';
import { Badge, Button, Field, Input, SegmentedControl } from '@/components/ui/lq';
import { useText, type Copy } from '@/lib/i18n';

const es = {
  readError: 'Error al leer el archivo',
  skinPng: 'La skin debe ser un archivo PNG.',
  skinTooBig: 'La skin supera el límite de 1 MB.',
  skinSize: 'Usa una skin estándar de Minecraft de 64×64 o 64×32 píxeles.',
  skinPrep: 'No se pudo preparar la vista previa de la skin.',
  skinRead: 'No se pudo leer la skin de Minecraft.',
  skinFileRead: 'No se pudo leer el archivo de skin.',
  pixelSaved: '¡Avatar pixel guardado!',
  saveErr: 'Error al guardar el avatar. Intenta de nuevo.',
  notImage: 'Por favor selecciona un archivo de imagen válido.',
  processImg: 'Error al procesar la imagen.',
  skinReady: 'Skin lista para previsualizar. Guarda y equipa para aplicarla.',
  skinProcess: 'No se pudo procesar la skin.',
  previewUpdated: 'Vista previa actualizada ',
  photoSaved: '¡Foto de perfil actualizada!',
  photoRemoved: 'Foto de perfil eliminada.',
  photoSaveErr: 'Error al actualizar foto de perfil.',
  removedUseSkin: 'Foto eliminada, se usará tu skin de Minecraft.',
  removedUsePixel: 'Foto eliminada, se usará tu avatar pixel.',
  photoRemoveErr: 'Error al quitar foto.',
  skinSelectFirst: 'Selecciona una skin de Minecraft antes de guardarla.',
  skinSaved: '¡Skin de Minecraft guardada y equipada!',
  skinNotConfirmed: 'La API no confirmó la skin. Tu vista previa se conserva: inténtalo de nuevo.',
  skinSaveErr: 'Error al guardar la skin de Minecraft. Tu vista previa se conserva.',
  skinRemovedPhoto: 'Skin eliminada, se usará tu foto de perfil.',
  skinRemovedPixel: 'Skin eliminada, se usará tu avatar pixel.',
  skinRemoveErr: 'Error al quitar la skin de Minecraft.',
  close: 'Cerrar',
  title: 'Tu personaje',
  typeAria: 'Tipo de avatar',
  tabPixel: 'Pixel',
  tabPhoto: 'Foto',
  tabSkin: 'Skin MC',
  done: 'Listo',
  save: 'Guardar',
  photoIntro: 'Sube una foto desde tu dispositivo o pega el enlace de una imagen.',
  photoAlt: 'Vista previa de tu foto',
  loadImgErr: 'No se pudo cargar la imagen desde el enlace.',
  photoActive: 'Foto activa',
  uploadAria: 'Subir foto',
  selfieAria: 'Tomar selfie',
  selfie: 'Tomar selfie',
  fromDevice: 'Subir desde el dispositivo',
  adjust: 'Ajustar encuadre',
  pasteLink: 'O pega un enlace',
  see: 'Ver',
  savePhoto: 'Guardar foto de perfil',
  removePhoto: 'Quitar foto',
  skinIntro: 'Sube una textura PNG de Minecraft; se dibuja como tu personaje en 3D sin borrar tu foto ni tu avatar pixel.',
  skinEmpty: 'Tu skin aparecerá aquí',
  skinHint: 'Skins Java de 64×64 o clásicas de 64×32.',
  changeSkin: 'Cambiar skin',
  uploadSkin: 'Subir skin',
  tempTitle: 'Vista previa temporal.',
  tempBody: 'Guarda y equipa la skin para aplicarla. Si cierras la pestaña, la selección se conserva al volver.',
  skinFoot: 'PNG de 64×64 (las de 64×32 se adaptan). Solo se guarda en tu perfil al pulsar el botón; no se envía a ningún visor externo.',
  saveEquip: 'Guardar y equipar skin',
  equip: 'Equipar skin',
  removeSkin: 'Quitar skin',
  photoAdjusted: 'Foto ajustada. Guárdala para aplicarla.',
};

const en: typeof es = {
  readError: 'Could not read the file',
  skinPng: 'The skin must be a PNG file.',
  skinTooBig: 'The skin is over the 1 MB limit.',
  skinSize: 'Use a standard Minecraft skin of 64×64 or 64×32 pixels.',
  skinPrep: 'Could not prepare the skin preview.',
  skinRead: 'Could not read the Minecraft skin.',
  skinFileRead: 'Could not read the skin file.',
  pixelSaved: 'Pixel avatar saved!',
  saveErr: 'Error saving the avatar. Try again.',
  notImage: 'Please select a valid image file.',
  processImg: 'Error processing the image.',
  skinReady: 'Skin ready to preview. Save and equip it to apply it.',
  skinProcess: 'Could not process the skin.',
  previewUpdated: 'Preview updated ',
  photoSaved: 'Profile photo updated!',
  photoRemoved: 'Profile photo removed.',
  photoSaveErr: 'Error updating the profile photo.',
  removedUseSkin: 'Photo removed, your Minecraft skin will be used.',
  removedUsePixel: 'Photo removed, your pixel avatar will be used.',
  photoRemoveErr: 'Error removing the photo.',
  skinSelectFirst: 'Select a Minecraft skin before saving it.',
  skinSaved: 'Minecraft skin saved and equipped!',
  skinNotConfirmed: 'The API did not confirm the skin. Your preview is kept: try again.',
  skinSaveErr: 'Error saving the Minecraft skin. Your preview is kept.',
  skinRemovedPhoto: 'Skin removed, your profile photo will be used.',
  skinRemovedPixel: 'Skin removed, your pixel avatar will be used.',
  skinRemoveErr: 'Error removing the Minecraft skin.',
  close: 'Close',
  title: 'Your character',
  typeAria: 'Avatar type',
  tabPixel: 'Pixel',
  tabPhoto: 'Photo',
  tabSkin: 'MC Skin',
  done: 'Done',
  save: 'Save',
  photoIntro: 'Upload a photo from your device or paste an image link.',
  photoAlt: 'Preview of your photo',
  loadImgErr: 'Could not load the image from that link.',
  photoActive: 'Photo active',
  uploadAria: 'Upload photo',
  selfieAria: 'Take a selfie',
  selfie: 'Take a selfie',
  fromDevice: 'Upload from device',
  adjust: 'Adjust framing',
  pasteLink: 'Or paste a link',
  see: 'View',
  savePhoto: 'Save profile photo',
  removePhoto: 'Remove photo',
  skinIntro: 'Upload a Minecraft PNG texture; it is drawn as your 3D character without deleting your photo or your pixel avatar.',
  skinEmpty: 'Your skin will appear here',
  skinHint: 'Java skins of 64×64 or classic ones of 64×32.',
  changeSkin: 'Change skin',
  uploadSkin: 'Upload skin',
  tempTitle: 'Temporary preview.',
  tempBody: 'Save and equip the skin to apply it. If you close the tab, your selection is kept when you come back.',
  skinFoot: 'PNG of 64×64 (64×32 ones are adapted). It is only saved to your profile when you press the button; it is not sent to any external viewer.',
  saveEquip: 'Save and equip skin',
  equip: 'Equip skin',
  removeSkin: 'Remove skin',
  photoAdjusted: 'Photo adjusted. Save it to apply it.',
};

const COPY: Copy<typeof es> = { es, en };

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function readAsDataUrl(file: File, t: typeof es): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(t.readError));
    reader.readAsDataURL(file);
  });
}

const MINECRAFT_SKIN_SIZE = 64;
const MAX_MINECRAFT_SKIN_BYTES = 1024 * 1024;
const MINECRAFT_SKIN_DRAFT_PREFIX = 'lifequest.minecraft-skin-draft';

type AvatarTab = 'pixel' | 'photo' | 'minecraft';

function minecraftSkinDraftKey(userId?: string): string {
  return `${MINECRAFT_SKIN_DRAFT_PREFIX}:${userId ?? 'anonymous'}`;
}

function readMinecraftSkinDraft(userId?: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const draft = window.sessionStorage.getItem(minecraftSkinDraftKey(userId)) ?? '';
    return /^data:image\/png;base64,/i.test(draft) && draft.length <= 100_000 ? draft : '';
  } catch {
    return '';
  }
}

function saveMinecraftSkinDraft(userId: string | undefined, skinUrl: string): void {
  try {
    window.sessionStorage.setItem(minecraftSkinDraftKey(userId), skinUrl);
  } catch {
    // A blocked or full sessionStorage must never prevent selecting a skin.
  }
}

function clearMinecraftSkinDraft(userId?: string): void {
  try {
    window.sessionStorage.removeItem(minecraftSkinDraftKey(userId));
  } catch {
    // no-op
  }
}

function initialTabFor(config: AvatarConfig | undefined, avatarUrl?: string | null): AvatarTab {
  if (config?.avatarMode === 'minecraft' && config.minecraftSkinUrl) return 'minecraft';
  if (config?.avatarMode === 'pixel') return 'pixel';
  if (config?.avatarMode === 'photo' && avatarUrl) return 'photo';
  return avatarUrl ? 'photo' : 'pixel';
}

/**
 * Minecraft Java skins are 64×64 PNGs. Legacy 64×32 files are expanded to
 * 64×64 by reusing the old right-side limbs, so they still render as a complete
 * character without altering the original user's photo/avatar options.
 */
function normalizeMinecraftSkin(file: File, t: typeof es): Promise<string> {
  return new Promise((resolve, reject) => {
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (!isPng) {
      reject(new Error(t.skinPng));
      return;
    }
    if (file.size > MAX_MINECRAFT_SKIN_BYTES) {
      reject(new Error(t.skinTooBig));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const isModern = image.naturalWidth === MINECRAFT_SKIN_SIZE && image.naturalHeight === MINECRAFT_SKIN_SIZE;
        const isLegacy = image.naturalWidth === MINECRAFT_SKIN_SIZE && image.naturalHeight === MINECRAFT_SKIN_SIZE / 2;
        if (!isModern && !isLegacy) {
          reject(new Error(t.skinSize));
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = MINECRAFT_SKIN_SIZE;
        canvas.height = MINECRAFT_SKIN_SIZE;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error(t.skinPrep));
          return;
        }

        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, MINECRAFT_SKIN_SIZE, MINECRAFT_SKIN_SIZE);
        context.drawImage(image, 0, 0);

        if (isLegacy) {
          // Legacy skins only contain right arm/right leg. Copy them into the
          // modern left-side slots so the 3D renderer never leaves limbs blank.
          context.drawImage(canvas, 0, 16, 16, 16, 16, 48, 16, 16);
          context.drawImage(canvas, 40, 16, 16, 16, 32, 48, 16, 16);
        }

        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => reject(new Error(t.skinRead));
      image.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error(t.skinFileRead));
    reader.readAsDataURL(file);
  });
}

export function AvatarCustomizer({ isOpen, onClose }: Props) {
  const t = useText(COPY);
  const { user, updateUser } = useAuthStore();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<AvatarTab>(() => initialTabFor(user?.avatarConfig, user?.avatarUrl));
  const [config, setConfig] = useState<AvatarConfig>(withDefaults(user?.avatarConfig));
  const [photoUrl, setPhotoUrl] = useState<string>(user?.avatarUrl ?? '');
  const [skinUrl, setSkinUrl] = useState<string>(() => readMinecraftSkinDraft(user?.id) || user?.avatarConfig?.minecraftSkinUrl || '');
  const [urlInput, setUrlInput] = useState<string>('');
  /** Imagen en el editor de recorte (null = vista previa normal). */
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const cropOpen = useRef(false);
  cropOpen.current = cropSrc !== null;
  const [saving, setSaving] = useState(false);
  /** Se incrementa al guardar el pixel: el escenario celebra antes de cerrar. */
  const [celebrate, setCelebrate] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const skinInputRef = useRef<HTMLInputElement>(null);
  const initializedModalUserRef = useRef<string | undefined>(undefined);
  const hasInitializedModalRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasInitializedModalRef.current = false;
      initializedModalUserRef.current = undefined;
      return;
    }

    // The auth store refreshes on navigation/focus. Do not reset a tab or its
    // in-progress preview when that refresh is for the same signed-in user.
    if (hasInitializedModalRef.current && initializedModalUserRef.current === user?.id) return;

    setConfig(withDefaults(user?.avatarConfig));
    setPhotoUrl(user?.avatarUrl ?? '');
    setSkinUrl(readMinecraftSkinDraft(user?.id) || user?.avatarConfig?.minecraftSkinUrl || '');
    setUrlInput('');
    setCropSrc(null);
    setActiveTab(initialTabFor(user?.avatarConfig, user?.avatarUrl));
    initializedModalUserRef.current = user?.id;
    hasInitializedModalRef.current = true;
  }, [isOpen, user]);

  const savedSkinUrl = user?.avatarConfig?.minecraftSkinUrl ?? '';
  const hasUnsavedSkinDraft = Boolean(skinUrl && skinUrl !== savedSkinUrl);

  const handleSavePixelAvatar = async () => {
    setSaving(true);
    try {
      const nextConfig: AvatarConfig = { ...config, avatarMode: 'pixel' };
      const updatedUser = await updateAvatar(nextConfig);
      setConfig(withDefaults(updatedUser.avatarConfig));
      updateUser(updatedUser);
      setCelebrate((c) => c + 1);
      toast.success(t.pixelSaved);
      window.setTimeout(() => { setCelebrate(0); onClose(); }, 1500);
    } catch {
      toast.error(t.saveErr);
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t.notImage);
      return;
    }

    try {
      // Primero se encuadra (zoom, posición, giro); el recorte genera el JPEG final.
      setCropSrc(await readAsDataUrl(file, t));
    } catch {
      toast.error(t.processImg);
    } finally {
      e.target.value = '';
    }
  };

  const handleSkinFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const normalizedSkin = await normalizeMinecraftSkin(file, t);
      setSkinUrl(normalizedSkin);
      saveMinecraftSkinDraft(user?.id, normalizedSkin);
      toast.success(t.skinReady);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.skinProcess);
    } finally {
      // Allows choosing the same file again after correcting or removing it.
      e.target.value = '';
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setPhotoUrl(urlInput.trim());
    setUrlInput('');
    toast.success(t.previewUpdated);
  };

  const handleSavePhotoProfile = async () => {
    setSaving(true);
    try {
      const mode: AvatarMode = photoUrl.trim() ? 'photo' : skinUrl ? 'minecraft' : 'pixel';
      await updateAvatar({ ...config, avatarMode: mode });
      const updatedUser = await updateProfile({ avatarUrl: photoUrl.trim() || null });
      setConfig(withDefaults(updatedUser.avatarConfig));
      updateUser(updatedUser);
      toast.success(photoUrl ? t.photoSaved : t.photoRemoved);
      onClose();
    } catch {
      toast.error(t.photoSaveErr);
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    setSaving(true);
    try {
      const mode: AvatarMode = skinUrl ? 'minecraft' : 'pixel';
      await updateAvatar({ ...config, avatarMode: mode });
      const updatedUser = await updateProfile({ avatarUrl: null });
      setConfig(withDefaults(updatedUser.avatarConfig));
      setPhotoUrl('');
      updateUser(updatedUser);
      toast.success(skinUrl ? t.removedUseSkin : t.removedUsePixel);
    } catch {
      toast.error(t.photoRemoveErr);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMinecraftSkin = async () => {
    if (!skinUrl) {
      toast.error(t.skinSelectFirst);
      return;
    }

    setSaving(true);
    try {
      const updatedUser = await updateAvatar({
        ...config,
        avatarMode: 'minecraft',
        minecraftSkinUrl: skinUrl,
      });
      if (updatedUser.avatarConfig.avatarMode !== 'minecraft' || !updatedUser.avatarConfig.minecraftSkinUrl) {
        throw new Error('SKIN_NOT_PERSISTED');
      }
      clearMinecraftSkinDraft(user?.id);
      setConfig(withDefaults(updatedUser.avatarConfig));
      updateUser(updatedUser);
      toast.success(t.skinSaved);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'SKIN_NOT_PERSISTED'
        ? t.skinNotConfirmed
        : t.skinSaveErr);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMinecraftSkin = async () => {
    setSaving(true);
    try {
      const mode: AvatarMode = photoUrl.trim() ? 'photo' : 'pixel';
      const updatedUser = await updateAvatar({
        ...config,
        avatarMode: mode,
        minecraftSkinUrl: null,
      });
      clearMinecraftSkinDraft(user?.id);
      setConfig(withDefaults(updatedUser.avatarConfig));
      setSkinUrl('');
      updateUser(updatedUser);
      toast.success(photoUrl ? t.skinRemovedPhoto : t.skinRemovedPixel);
    } catch {
      toast.error(t.skinRemoveErr);
    } finally {
      setSaving(false);
    }
  };

  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tabs = [
    { value: 'pixel' as const, label: t.tabPixel },
    { value: 'photo' as const, label: t.tabPhoto },
    { value: 'minecraft' as const, label: t.tabSkin },
  ];

  // Diálogo a pantalla completa: Escape cierra, el foco queda dentro y vuelve
  // al botón que lo abrió; el fondo no se desplaza mientras está abierto.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    lockScroll();
    const timer = window.setTimeout(() => closeRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      // Con el recorte abierto, Escape solo lo cancela.
      if (e.key === 'Escape') { e.preventDefault(); if (cropOpen.current) setCropSrc(null); else onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const f = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]):not([type=radio]),input[type=radio]:checked,[tabindex="0"],a[href]')].filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', onKey); unlockScroll(); opener?.focus?.(); };
  }, [isOpen, onClose]);

  // En el body: un ancestro con transform o filtro haría que el fixed se pintara dentro de la página.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div key="studio" className="fixed inset-0 z-50 flex md:p-3">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
            exit={{ opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.2 } }}
            className="relative flex size-full flex-col overflow-hidden bg-background text-on-background shadow-lg md:rounded-[28px] md:border md:border-border"
          >
            <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-2 md:gap-4 md:px-5">
              <Button ref={closeRef} variant="icon" aria-label={t.close} onClick={onClose}>
                <X aria-hidden className="size-6" strokeWidth={1.75} />
              </Button>
              <h2 id={titleId} className="hidden text-heading-sm md:block">{t.title}</h2>
              <div className="mx-auto w-full max-w-[280px]">
                <SegmentedControl role="tablist" label={t.typeAria} value={activeTab} onChange={setActiveTab} options={tabs} />
              </div>
              {activeTab === 'pixel' ? (
                <motion.span key="save" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <Button size="md" loading={saving} onClick={handleSavePixelAvatar} className="min-w-[104px]">
                    {celebrate ? <><Check aria-hidden className="size-5" strokeWidth={2.25} />{t.done}</> : t.save}
                  </Button>
                </motion.span>
              ) : <span aria-hidden className="w-11 shrink-0 md:w-[104px]" />}
            </header>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
                className="flex min-h-0 flex-1 flex-col"
              >
                {activeTab === 'pixel' ? (
                  <AvatarStudio config={config} onChange={setConfig} celebrate={celebrate} />
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
                      {activeTab === 'photo' ? (
                        cropSrc ? (
                          <PhotoCropper
                            src={cropSrc}
                            onCancel={() => setCropSrc(null)}
                            onApply={(url) => { setPhotoUrl(url); setCropSrc(null); toast.success(t.photoAdjusted); }}
                          />
                        ) : (
                          <>
                            <p className="text-body-md text-on-surface-light">{t.photoIntro}</p>
                            <div className="relative flex justify-center pb-3">
                              <span className="flex size-36 items-center justify-center overflow-hidden rounded-full bg-surface-variant shadow-[0_0_0_4px_rgb(var(--lq-background)),0_0_0_6px_rgb(var(--lq-primary)/0.4)]">
                                {photoUrl ? (
                                  <img src={photoUrl} alt={t.photoAlt} className="size-full object-cover" onError={() => toast.error(t.loadImgErr)} />
                                ) : (
                                  <AvatarPreview config={config} size={104} className="bg-transparent" />
                                )}
                              </span>
                              {photoUrl && <Badge variant="success" className="absolute bottom-0 left-1/2 -translate-x-1/2">{t.photoActive}</Badge>}
                            </div>
                            <input type="file" aria-label={t.uploadAria} ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" tabIndex={-1} />
                            {/* La cámara frontal abre directamente en Android/iOS dentro de la PWA. */}
                            <input type="file" aria-label={t.selfieAria} ref={selfieInputRef} onChange={handleFileSelect} accept="image/*" capture="user" className="hidden" tabIndex={-1} />
                            <Button variant="secondary" block onClick={() => selfieInputRef.current?.click()}>
                              <Camera aria-hidden className="size-5" strokeWidth={1.75} />{t.selfie}
                            </Button>
                            <Button variant="ghost" block onClick={() => fileInputRef.current?.click()}>
                              <Upload aria-hidden className="size-5" strokeWidth={1.75} />{t.fromDevice}
                            </Button>
                            {photoUrl && (
                              <Button variant="ghost" block onClick={() => setCropSrc(photoUrl)}>
                                <Crop aria-hidden className="size-5" strokeWidth={1.75} />{t.adjust}
                              </Button>
                            )}
                            <div className="flex items-end gap-2">
                              <Field label={t.pasteLink} className="flex-1">
                                <Input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://ejemplo.com/foto.jpg" />
                              </Field>
                              <Button variant="secondary" onClick={handleApplyUrl} disabled={!urlInput.trim()} className="min-h-12">
                                <LinkIcon aria-hidden className="size-5" strokeWidth={1.75} />{t.see}
                              </Button>
                            </div>
                            <div className="flex flex-col gap-2 border-t border-border pt-4">
                              <Button size="lg" block loading={saving} onClick={handleSavePhotoProfile}>{t.savePhoto}</Button>
                              {user?.avatarUrl && (
                                <Button variant="danger" block disabled={saving} onClick={handleRemovePhoto}>
                                  <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />{t.removePhoto}
                                </Button>
                              )}
                            </div>
                          </>
                        )
                      ) : (
                        <>
                          <p className="text-body-md text-on-surface-light">{t.skinIntro}</p>
                          <div className="flex min-h-[224px] items-center justify-center rounded-2xl border border-border bg-surface p-5">
                            {skinUrl ? (
                              <motion.div key={skinUrl} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
                                <MinecraftSkinAvatar skinUrl={skinUrl} size={164} animate="idle" />
                              </motion.div>
                            ) : (
                              <div className="flex max-w-[240px] flex-col items-center gap-2 text-center">
                                <Box aria-hidden className="size-8 text-on-surface-light" strokeWidth={1.5} />
                                <p className="text-label-lg">{t.skinEmpty}</p>
                                <p className="text-body-sm text-on-surface-light">{t.skinHint}</p>
                              </div>
                            )}
                          </div>
                          <input ref={skinInputRef} type="file" accept="image/png,.png" onChange={handleSkinFileSelect} className="hidden" tabIndex={-1} />
                          <Button variant="secondary" block onClick={() => skinInputRef.current?.click()}>
                            <Upload aria-hidden className="size-5" strokeWidth={1.75} />{skinUrl ? t.changeSkin : t.uploadSkin}
                          </Button>
                          {hasUnsavedSkinDraft && (
                            <p role="status" className="rounded-xl bg-warning/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-warning-text">
                              <b>{t.tempTitle}</b> {t.tempBody}
                            </p>
                          )}
                          <p className="text-body-sm text-on-surface-light">{t.skinFoot}</p>
                          <div className="flex flex-col gap-2 border-t border-border pt-4">
                            <Button size="lg" block loading={saving} disabled={!skinUrl} onClick={handleSaveMinecraftSkin}>
                              {hasUnsavedSkinDraft ? t.saveEquip : t.equip}
                            </Button>
                            {(skinUrl || user?.avatarConfig?.minecraftSkinUrl) && (
                              <Button variant="danger" block disabled={saving} onClick={handleRemoveMinecraftSkin}>
                                <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />{t.removeSkin}
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
