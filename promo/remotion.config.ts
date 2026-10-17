// Ajustes de render del vídeo promocional. Van aquí para que el comando corto
// `npx remotion render NoutLifePromoVertical out/noutlife-promo.mp4` ya salga en
// máxima calidad y listo para Reels, TikTok y Shorts (H.264 + AAC, yuv420p, bt709).
import { Config } from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');
// Fotogramas en PNG (sin pérdida) antes de codificar; JPEG deja bandas en los degradados oscuros.
Config.setVideoImageFormat('png');
Config.setCodec('h264');
// CRF 14 + preset slow: casi sin pérdida a un tamaño razonable (Remotion usa 18 por defecto).
Config.setCrf(14);
Config.setX264Preset('slow');
// yuv420p es el único formato de píxel que aceptan todas las redes; bt709 evita que los colores se laven al subirlo.
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setAudioCodec('aac');
Config.setAudioBitrate('320k');
Config.setOverwriteOutput(true);
