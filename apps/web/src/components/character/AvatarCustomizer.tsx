// Personalizar avatar — ResponsiveDialog (modal md+, hoja en móvil) con tres
// pestañas: Pixel, Foto y Skin de Minecraft. La lógica de guardado es la de
// antes; cambia la presentación (lq) y el editor pixel compartido.
import { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link as LinkIcon, Box, Trash2, Upload } from 'lucide-react';
import { MinecraftSkinAvatar } from './MinecraftSkinAvatar';
import { AvatarPixelEditor, AvatarPreview } from './AvatarPixelEditor';
import { withDefaults } from './avatarOptions';
import { updateAvatar, updateProfile } from '../../services/user.service';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import type { AvatarConfig, AvatarMode } from '@lifequest/shared';
import { Badge, Button, Field, Input, ResponsiveDialog, Tabs } from '@/components/ui/lq';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function compressAndResizeImage(file: File, maxWidth = 350, maxHeight = 350): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
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
function normalizeMinecraftSkin(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (!isPng) {
      reject(new Error('La skin debe ser un archivo PNG.'));
      return;
    }
    if (file.size > MAX_MINECRAFT_SKIN_BYTES) {
      reject(new Error('La skin supera el límite de 1 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const isModern = image.naturalWidth === MINECRAFT_SKIN_SIZE && image.naturalHeight === MINECRAFT_SKIN_SIZE;
        const isLegacy = image.naturalWidth === MINECRAFT_SKIN_SIZE && image.naturalHeight === MINECRAFT_SKIN_SIZE / 2;
        if (!isModern && !isLegacy) {
          reject(new Error('Usa una skin estándar de Minecraft de 64×64 o 64×32 píxeles.'));
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = MINECRAFT_SKIN_SIZE;
        canvas.height = MINECRAFT_SKIN_SIZE;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('No se pudo preparar la vista previa de la skin.'));
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
      image.onerror = () => reject(new Error('No se pudo leer la skin de Minecraft.'));
      image.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de skin.'));
    reader.readAsDataURL(file);
  });
}

export function AvatarCustomizer({ isOpen, onClose }: Props) {
  const { user, updateUser } = useAuthStore();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<AvatarTab>(() => initialTabFor(user?.avatarConfig, user?.avatarUrl));
  const [config, setConfig] = useState<AvatarConfig>(withDefaults(user?.avatarConfig));
  const [photoUrl, setPhotoUrl] = useState<string>(user?.avatarUrl ?? '');
  const [skinUrl, setSkinUrl] = useState<string>(() => readMinecraftSkinDraft(user?.id) || user?.avatarConfig?.minecraftSkinUrl || '');
  const [urlInput, setUrlInput] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      toast.success('¡Avatar pixel guardado!');
      onClose();
    } catch {
      toast.error('Error al guardar el avatar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen válido.');
      return;
    }

    try {
      const compressedBase64 = await compressAndResizeImage(file);
      setPhotoUrl(compressedBase64);
      toast.success('Imagen seleccionada correctamente ');
    } catch {
      toast.error('Error al procesar la imagen.');
    }
  };

  const handleSkinFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const normalizedSkin = await normalizeMinecraftSkin(file);
      setSkinUrl(normalizedSkin);
      saveMinecraftSkinDraft(user?.id, normalizedSkin);
      toast.success('Skin lista para previsualizar. Guarda y equipa para aplicarla.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo procesar la skin.');
    } finally {
      // Allows choosing the same file again after correcting or removing it.
      e.target.value = '';
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setPhotoUrl(urlInput.trim());
    setUrlInput('');
    toast.success('Vista previa actualizada ');
  };

  const handleSavePhotoProfile = async () => {
    setSaving(true);
    try {
      const mode: AvatarMode = photoUrl.trim() ? 'photo' : skinUrl ? 'minecraft' : 'pixel';
      await updateAvatar({ ...config, avatarMode: mode });
      const updatedUser = await updateProfile({ avatarUrl: photoUrl.trim() || null });
      setConfig(withDefaults(updatedUser.avatarConfig));
      updateUser(updatedUser);
      toast.success(photoUrl ? '¡Foto de perfil actualizada!' : 'Foto de perfil eliminada.');
      onClose();
    } catch {
      toast.error('Error al actualizar foto de perfil.');
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
      toast.success(skinUrl ? 'Foto eliminada, se usará tu skin de Minecraft.' : 'Foto eliminada, se usará tu avatar pixel.');
    } catch {
      toast.error('Error al quitar foto.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMinecraftSkin = async () => {
    if (!skinUrl) {
      toast.error('Selecciona una skin de Minecraft antes de guardarla.');
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
      toast.success('¡Skin de Minecraft guardada y equipada!');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'SKIN_NOT_PERSISTED'
        ? 'La API no confirmó la skin. Tu vista previa se conserva: inténtalo de nuevo.'
        : 'Error al guardar la skin de Minecraft. Tu vista previa se conserva.');
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
      toast.success(photoUrl ? 'Skin eliminada, se usará tu foto de perfil.' : 'Skin eliminada, se usará tu avatar pixel.');
    } catch {
      toast.error('Error al quitar la skin de Minecraft.');
    } finally {
      setSaving(false);
    }
  };

  const panelId = useId();
  const tabs = [
    { value: 'pixel' as const, label: 'Pixel' },
    { value: 'photo' as const, label: 'Foto' },
    { value: 'minecraft' as const, label: 'Skin MC' },
  ];

  return (
    <ResponsiveDialog open={isOpen} onClose={onClose} title="Personaliza tu avatar" className="md:max-w-[560px]">
      <Tabs label="Tipo de avatar" value={activeTab} onChange={setActiveTab} options={tabs} />

      <div role="tabpanel" id={panelId} aria-label={tabs.find((t) => t.value === activeTab)?.label} className="flex flex-col gap-6">
        {activeTab === 'photo' ? (
          <>
            <p className="text-body-md text-on-surface-light">Sube una foto desde tu dispositivo o pega el enlace de una imagen.</p>
            <div className="relative flex justify-center pb-3">
              <span className="flex size-36 items-center justify-center overflow-hidden rounded-full bg-surface-variant shadow-[0_0_0_4px_rgb(var(--lq-background)),0_0_0_6px_rgb(var(--lq-primary)/0.4)]">
                {photoUrl ? (
                  <img src={photoUrl} alt="Vista previa de tu foto" className="size-full object-cover" onError={() => toast.error('No se pudo cargar la imagen desde el enlace.')} />
                ) : (
                  <AvatarPreview config={config} size={104} className="bg-transparent" />
                )}
              </span>
              {photoUrl && <Badge variant="success" className="absolute bottom-0 left-1/2 -translate-x-1/2">Foto activa</Badge>}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" tabIndex={-1} />
            <Button variant="secondary" block onClick={() => fileInputRef.current?.click()}>
              <Upload aria-hidden className="size-5" strokeWidth={1.75} />Subir desde el dispositivo
            </Button>
            <div className="flex items-end gap-2">
              <Field label="O pega un enlace" className="flex-1">
                <Input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://ejemplo.com/foto.jpg" />
              </Field>
              <Button variant="secondary" onClick={handleApplyUrl} disabled={!urlInput.trim()} className="min-h-12">
                <LinkIcon aria-hidden className="size-5" strokeWidth={1.75} />Ver
              </Button>
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button size="lg" block loading={saving} onClick={handleSavePhotoProfile}>Guardar foto de perfil</Button>
              {user?.avatarUrl && (
                <Button variant="danger" block disabled={saving} onClick={handleRemovePhoto}>
                  <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />Quitar foto
                </Button>
              )}
            </div>
          </>
        ) : activeTab === 'minecraft' ? (
          <>
            <p className="text-body-md text-on-surface-light">Sube una textura PNG de Minecraft; se dibuja como tu personaje en 3D sin borrar tu foto ni tu avatar pixel.</p>
            <div className="flex min-h-[224px] items-center justify-center rounded-2xl border border-border bg-surface p-5">
              {skinUrl ? (
                <motion.div key={skinUrl} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
                  <MinecraftSkinAvatar skinUrl={skinUrl} size={164} animate="idle" />
                </motion.div>
              ) : (
                <div className="flex max-w-[240px] flex-col items-center gap-2 text-center">
                  <Box aria-hidden className="size-8 text-on-surface-light" strokeWidth={1.5} />
                  <p className="text-label-lg">Tu skin aparecerá aquí</p>
                  <p className="text-body-sm text-on-surface-light">Skins Java de 64×64 o clásicas de 64×32.</p>
                </div>
              )}
            </div>
            <input ref={skinInputRef} type="file" accept="image/png,.png" onChange={handleSkinFileSelect} className="hidden" tabIndex={-1} />
            <Button variant="secondary" block onClick={() => skinInputRef.current?.click()}>
              <Upload aria-hidden className="size-5" strokeWidth={1.75} />{skinUrl ? 'Cambiar skin' : 'Subir skin'}
            </Button>
            {hasUnsavedSkinDraft && (
              <p role="status" className="rounded-xl bg-warning/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-warning-text">
                <b>Vista previa temporal.</b> Guarda y equipa la skin para aplicarla. Si cierras la pestaña, la selección se conserva al volver.
              </p>
            )}
            <p className="text-body-sm text-on-surface-light">PNG de 64×64 (las de 64×32 se adaptan). Solo se guarda en tu perfil al pulsar el botón; no se envía a ningún visor externo.</p>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button size="lg" block loading={saving} disabled={!skinUrl} onClick={handleSaveMinecraftSkin}>
                {hasUnsavedSkinDraft ? 'Guardar y equipar skin' : 'Equipar skin'}
              </Button>
              {(skinUrl || user?.avatarConfig?.minecraftSkinUrl) && (
                <Button variant="danger" block disabled={saving} onClick={handleRemoveMinecraftSkin}>
                  <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />Quitar skin
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <AvatarPreview config={config} size={96} />
            </div>
            <AvatarPixelEditor config={config} onChange={setConfig} />
            <div className="sticky bottom-0 -mx-4 -mb-8 flex gap-2 border-t border-border bg-background px-4 pb-4 pt-4 md:-mx-6 md:-mb-6 md:px-6">
              <Button variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
              <Button size="lg" loading={saving} onClick={handleSavePixelAvatar} className="flex-1">Guardar</Button>
            </div>
          </>
        )}
      </div>
    </ResponsiveDialog>
  );
}
