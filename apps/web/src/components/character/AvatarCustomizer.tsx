import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Link as LinkIcon, Trash2, Camera, User as UserIcon } from 'lucide-react';
import { MiguelSprite } from './MiguelSprite';
import { MinecraftSkinAvatar } from './MinecraftSkinAvatar';
import { ColorPicker } from '../onboarding/ColorPicker';
import { PixelButton } from '../ui/PixelButton';
import { updateAvatar, updateProfile } from '../../services/user.service';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import type { AvatarConfig, AvatarMode, HairStyle, Accessory, Expression } from '@lifequest/shared';
import { E } from '@/components/ui/glyphs';

const HAIR_COLORS  = ['#2c1810','#4a3728','#8b4513','#d4a017','#c8a2c8','#708090','#1a1a1a','#ff6b6b','#e8c090','#ffffff','#3d5a80','#c0392b'];
const SKIN_COLORS  = [
  '#fdf0e8','#fde8d0','#fcd9c0','#f8d5b0',
  '#f5c89f','#f0b98e','#e8a876','#d4956a',
  '#c68642','#b87340','#a86035','#a0522d',
  '#8b4513','#7b3f2c','#6b3422','#5c2e1a',
  '#4a2010','#3d1a0c','#2d1009','#1c0806',
];
const SHIRT_COLORS = ['#4d96ff','#ff6b9d','#4ecdc4','#6bcf7f','#ffd23f','#ff6347','#9b59b6','#2c3e50','#e74c3c','#1abc9c','#f97316','#64748b','#ffffff','#000000'];
const PANTS_COLORS = ['#37474f','#1a237e','#4e342e','#1b5e20','#880e4f','#263238','#000000','#5d4037','#b71c1c','#1565c0'];
const HAIR_STYLES_MALE: HairStyle[] = ['short', 'medium', 'long', 'shaved', 'copete', 'afro'];
const HAIR_STYLES_FEMALE: HairStyle[] = ['long', 'short', 'recogido', 'trenzas', 'ondulado', 'afro'];
const ACCESSORIES: Accessory[] = ['none', 'glasses', 'cap', 'headband', 'earrings', 'scarf'];
const EXPRESSIONS: Expression[] = ['normal', 'smile', 'serious', 'determined'];

const HAIR_STYLE_LABELS: Record<HairStyle, string> = {
  short: 'Corto',
  medium: 'Medio',
  long: 'Largo',
  shaved: 'Afeitado',
  copete: 'Copete',
  afro: 'Afro',
  recogido: 'Recogido',
  trenzas: 'Trenzas',
  ondulado: 'Ondulado',
};

const ACCESSORY_LABELS: Record<Accessory, string> = {
  none: 'Ninguno',
  glasses: 'Gafas',
  cap: 'Gorro',
  headband: 'Diadema',
  earrings: 'Aretes',
  scarf: 'Bufanda',
};

const EXPRESSION_LABELS: Record<Expression, string> = {
  normal: 'Normal',
  smile: 'Sonriente',
  serious: 'Serio',
  determined: 'Decidido',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_AVATAR: AvatarConfig = {
  bodyType: 'male',
  hairStyle: 'short',
  hairColor: '#2c1810',
  skinColor: '#c68642',
  shirtColor: '#4d96ff',
  pants: '#37474f',
  accessory: 'none',
  expression: 'normal',
  pet: null,
};

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

type AvatarTab = 'pixel' | 'photo' | 'minecraft';

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
  const [config, setConfig] = useState<AvatarConfig>(user?.avatarConfig ?? DEFAULT_AVATAR);
  const [photoUrl, setPhotoUrl] = useState<string>(user?.avatarUrl ?? '');
  const [skinUrl, setSkinUrl] = useState<string>(user?.avatarConfig?.minecraftSkinUrl ?? '');
  const [urlInput, setUrlInput] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setConfig(user?.avatarConfig ?? DEFAULT_AVATAR);
    setPhotoUrl(user?.avatarUrl ?? '');
    setSkinUrl(user?.avatarConfig?.minecraftSkinUrl ?? '');
    setUrlInput('');
    setActiveTab(initialTabFor(user?.avatarConfig, user?.avatarUrl));
  }, [isOpen, user]);

  const update = (key: keyof AvatarConfig) => (value: string) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const hairStyles = (config.bodyType === 'female') ? HAIR_STYLES_FEMALE : HAIR_STYLES_MALE;

  const handleSavePixelAvatar = async () => {
    setSaving(true);
    try {
      const nextConfig: AvatarConfig = { ...config, avatarMode: 'pixel' };
      const updatedUser = await updateAvatar(nextConfig);
      setConfig(updatedUser.avatarConfig);
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
      toast.success('Skin de Minecraft lista para previsualizar.');
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
      setConfig(updatedUser.avatarConfig);
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
      setConfig(updatedUser.avatarConfig);
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
      setConfig(updatedUser.avatarConfig);
      updateUser(updatedUser);
      toast.success('¡Skin de Minecraft equipada!');
      onClose();
    } catch {
      toast.error('Error al guardar la skin de Minecraft.');
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
      setConfig(updatedUser.avatarConfig);
      setSkinUrl('');
      updateUser(updatedUser);
      toast.success(photoUrl ? 'Skin eliminada, se usará tu foto de perfil.' : 'Skin eliminada, se usará tu avatar pixel.');
    } catch {
      toast.error('Error al quitar la skin de Minecraft.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[130] flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="bg-[var(--bg-panel)] border-4 border-[var(--accent-gold)] shadow-pixel-gold max-w-md w-full max-h-[90vh] flex flex-col rounded-xl overflow-hidden">
              {/* Header */}
              <motion.div className="flex items-center justify-between p-4 border-b-2 border-[var(--accent-gold)]/30 bg-gradient-to-r from-[var(--accent-gold)]/10 to-transparent">
                <h2 className="font-pixel text-[var(--accent-gold)] tracking-widest text-xs flex items-center gap-2">
                  <span><E e="✨" /> APARIENCIA <E e="✨" /></span>
                </h2>
                <motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  className="text-[var(--text-secondary)] hover:text-[var(--accent-gold)] transition-colors p-1"
                >
                  <X size={18} />
                </motion.button>
              </motion.div>

              {/* Tabs Selector */}
              <div className="flex border-b border-[var(--border)] bg-[var(--bg-panel-light)]">
                <button
                  onClick={() => setActiveTab('photo')}
                  className={`flex-1 px-1 py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'photo'
                      ? 'bg-[var(--bg-panel)] text-[var(--accent-gold)] border-b-2 border-[var(--accent-gold)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Camera size={14} />
                  <span>Foto</span>
                </button>
                <button
                  onClick={() => setActiveTab('minecraft')}
                  className={`flex-1 px-1 py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'minecraft'
                      ? 'bg-[var(--bg-panel)] text-[var(--accent-gold)] border-b-2 border-[var(--accent-gold)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span aria-hidden="true"><E e="⛏" s={12} /></span>
                  <span>Skin MC</span>
                </button>
                <button
                  onClick={() => setActiveTab('pixel')}
                  className={`flex-1 px-1 py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'pixel'
                      ? 'bg-[var(--bg-panel)] text-[var(--accent-gold)] border-b-2 border-[var(--accent-gold)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <UserIcon size={14} />
                  <span>Pixel</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-5 space-y-5 overflow-y-auto flex-1">
                {activeTab === 'photo' ? (
                  /* ── TAB FOTO DE PERFIL ── */
                  <div className="space-y-5">
                    <div className="text-center">
                      <p className="text-xs text-[var(--text-secondary)] mb-3">
                        Sube una foto real desde tu dispositivo o ingresa un enlace de imagen.
                      </p>

                      {/* Vista previa de la foto */}
                      <div className="relative inline-block my-2">
                        <div className="w-32 h-32 rounded-full border-4 border-[var(--accent-gold)] shadow-lg overflow-hidden bg-[var(--bg-panel-light)] flex items-center justify-center mx-auto">
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt="Vista previa"
                              className="w-full h-full object-cover"
                              onError={() => {
                                toast.error('No se pudo cargar la imagen desde el enlace.');
                              }}
                            />
                          ) : (
                            <MiguelSprite
                              size={120}
                              bodyType={config.bodyType}
                              hairStyle={config.hairStyle}
                              hairColor={config.hairColor}
                              skinColor={config.skinColor}
                              shirtColor={config.shirtColor}
                              pantsColor={config.pants}
                              accessory={config.accessory}
                              expression={config.expression}
                              animate="idle"
                            />
                          )}
                        </div>
                        {photoUrl && (
                          <span className="absolute bottom-1 right-1 bg-[var(--accent-green)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                            Foto activa
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botón para subir desde el dispositivo */}
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        className="hidden"
                      />
                      <PixelButton
                        variant="primary"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 text-xs py-2.5"
                      >
                        <Upload size={16} />
                        <span>Subir desde dispositivo</span>
                      </PixelButton>
                    </div>

                    {/* Separador */}
                    <div className="flex items-center my-3">
                      <div className="flex-1 border-t border-[var(--border)]" />
                      <span className="px-3 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">o por enlace</span>
                      <div className="flex-1 border-t border-[var(--border)]" />
                    </div>

                    {/* Input para URL de imagen */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                        <LinkIcon size={14} />
                        <span>URL de imagen web</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="https://ejemplo.com/foto.jpg"
                          className="flex-1 bg-[var(--bg-panel-light)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-gold)]"
                        />
                        <PixelButton variant="secondary" onClick={handleApplyUrl} className="text-xs px-3">
                          Ver
                        </PixelButton>
                      </div>
                    </div>

                    {/* Acciones de foto */}
                    <div className="pt-3 border-t border-[var(--border)] space-y-2">
                      <PixelButton
                        variant="primary"
                        onClick={handleSavePhotoProfile}
                        disabled={saving}
                        className="w-full text-xs py-2"
                      >
                        {saving ? 'Guardando...' : <><E e="💾" s={11} /> Guardar Foto de Perfil</>}
                      </PixelButton>

                      {user?.avatarUrl && (
                        <button
                          onClick={handleRemovePhoto}
                          disabled={saving}
                          className="w-full text-xs text-[var(--accent-red)] hover:underline flex items-center justify-center gap-1.5 py-1"
                        >
                          <Trash2 size={13} />
                          <span>Eliminar foto y usar otro estilo</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : activeTab === 'minecraft' ? (
                  /* ── TAB SKIN DE MINECRAFT ── */
                  <div className="space-y-5">
                    <div className="text-center">
                      <p className="text-xs leading-5 text-[var(--text-secondary)]">
                        Sube una textura PNG de Minecraft. La skin se renderiza como tu personaje en 3D sin eliminar tu foto de perfil ni tu avatar pixel.
                      </p>
                    </div>

                    <div className="flex min-h-[224px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-deep)] px-4 py-5 shadow-inner">
                      {skinUrl ? (
                        <motion.div
                          key={skinUrl}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                        >
                          <MinecraftSkinAvatar skinUrl={skinUrl} size={164} animate="idle" />
                        </motion.div>
                      ) : (
                        <div className="max-w-[230px] text-center">
                          <span className="text-3xl" aria-hidden="true"><E e="⛏" /></span>
                          <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">Tu skin aparecerá aquí</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Aceptamos skins Java modernas de 64×64 y clásicas de 64×32.</p>
                        </div>
                      )}
                    </div>

                    <input
                      ref={skinInputRef}
                      type="file"
                      accept="image/png,.png"
                      onChange={handleSkinFileSelect}
                      className="hidden"
                    />
                    <PixelButton
                      variant="primary"
                      onClick={() => skinInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 py-2.5 text-xs"
                    >
                      <Upload size={16} />
                      <span>{skinUrl ? 'Cambiar skin de Minecraft' : 'Subir skin de Minecraft'}</span>
                    </PixelButton>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-3 py-2.5 text-xs leading-5 text-[var(--text-secondary)]">
                      <strong className="font-semibold text-[var(--text-primary)]">Formato:</strong> PNG de 64×64 píxeles. Las skins clásicas de 64×32 se adaptan automáticamente. La textura se guarda en tu perfil; no se envía a un visor externo.
                    </div>

                    <div className="space-y-2 border-t border-[var(--border)] pt-3">
                      <PixelButton
                        variant="primary"
                        onClick={handleSaveMinecraftSkin}
                        disabled={saving || !skinUrl}
                        className="w-full py-2 text-xs"
                      >
                        {saving ? 'GUARDANDO...' : <><E e="⛏" s={11} /> EQUIPAR SKIN</>}
                      </PixelButton>

                      {(skinUrl || user?.avatarConfig?.minecraftSkinUrl) && (
                        <button
                          onClick={handleRemoveMinecraftSkin}
                          disabled={saving}
                          className="flex w-full items-center justify-center gap-1.5 py-1 text-xs text-[var(--accent-red)] hover:underline"
                        >
                          <Trash2 size={13} />
                          <span>Eliminar skin y usar otro estilo</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── TAB AVATAR PIXEL ── */
                  <div className="space-y-5">
                    <div>
                      <label className="font-pixel text-[var(--accent-gold)] block mb-2 text-[9px] tracking-wider">
                        GÉNERO
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['male', 'female'] as const).map((gender) => (
                          <motion.button
                            key={gender}
                            onClick={() => {
                              update('bodyType')(gender);
                              setConfig((c) => {
                                const femaleStyles: HairStyle[] = ['long', 'short', 'recogido', 'trenzas', 'ondulado', 'afro'];
                                const maleStyles: HairStyle[] = ['short', 'medium', 'long', 'shaved', 'copete', 'afro'];
                                const validStyles = gender === 'female' ? femaleStyles : maleStyles;
                                return {
                                  ...c,
                                  bodyType: gender,
                                  hairStyle: validStyles.includes(c.hairStyle) ? c.hairStyle : validStyles[0],
                                };
                              });
                            }}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className={`py-1.5 px-1.5 text-xs font-vt border-2 transition-all rounded-lg ${
                              config.bodyType === gender
                                ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] font-bold shadow-pixel-gold'
                                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)]'
                            }`}
                          >
                            {gender === 'male' ? <><E e="♂" s={11} /> Masculino</> : <><E e="♀" s={11} /> Femenino</>}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-center py-2">
                      <motion.div
                        key={JSON.stringify(config)}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="relative"
                      >
                        <div className="absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(circle at center, rgba(212,160,23,0.1), transparent)' }} />
                        <MiguelSprite
                          size={140}
                          bodyType={config.bodyType}
                          hairStyle={config.hairStyle}
                          hairColor={config.hairColor}
                          skinColor={config.skinColor}
                          shirtColor={config.shirtColor}
                          pantsColor={config.pants}
                          accessory={config.accessory}
                          expression={config.expression}
                          animate="celebrate"
                        />
                      </motion.div>
                    </div>

                    <div>
                      <label className="font-pixel text-[var(--accent-gold)] block mb-2 text-[9px] tracking-wider">
                        ESTILOS DE CABELLO
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {hairStyles.map((style) => (
                          <motion.button
                            key={style}
                            onClick={() => update('hairStyle')(style)}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className={`py-1.5 px-1.5 text-xs font-vt border-2 transition-all rounded-lg ${
                              config.hairStyle === style
                                ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] font-bold shadow-pixel-gold'
                                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)]'
                            }`}
                          >
                            {HAIR_STYLE_LABELS[style]}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <ColorPicker label="CABELLO" value={config.hairColor} colors={HAIR_COLORS} onChange={update('hairColor')} />
                    <ColorPicker label="PIEL" value={config.skinColor} colors={SKIN_COLORS} onChange={update('skinColor')} />
                    <ColorPicker label="CAMISA" value={config.shirtColor} colors={SHIRT_COLORS} onChange={update('shirtColor')} />
                    <ColorPicker label="PANTALÓN" value={config.pants} colors={PANTS_COLORS} onChange={update('pants')} />

                    <div>
                      <label className="font-pixel text-[var(--accent-gold)] block mb-2 text-[9px] tracking-wider">
                        ACCESORIOS
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {ACCESSORIES.map((acc) => (
                          <motion.button
                            key={acc}
                            onClick={() => update('accessory')(acc)}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className={`py-1.5 px-1.5 text-xs font-vt border-2 transition-all rounded-lg ${
                              config.accessory === acc
                                ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] font-bold shadow-pixel-gold'
                                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)]'
                            }`}
                          >
                            {ACCESSORY_LABELS[acc]}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="font-pixel text-[var(--accent-gold)] block mb-2 text-[9px] tracking-wider">
                        EXPRESIÓN
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {EXPRESSIONS.map((expr) => (
                          <motion.button
                            key={expr}
                            onClick={() => update('expression')(expr)}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className={`py-1.5 px-1.5 text-xs font-vt border-2 transition-all rounded-lg ${
                              config.expression === expr
                                ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] font-bold shadow-pixel-gold'
                                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)]'
                            }`}
                          >
                            {EXPRESSION_LABELS[expr]}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-3 border-t border-[var(--border)]">
                      <PixelButton variant="ghost" onClick={onClose} className="flex-1 text-xs">
                        CANCELAR
                      </PixelButton>
                      <PixelButton variant="primary" onClick={handleSavePixelAvatar} disabled={saving} className="flex-1 text-xs">
                        {saving ? 'GUARDANDO...' : <><E e="✨" s={11} /> GUARDAR</>}
                      </PixelButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
