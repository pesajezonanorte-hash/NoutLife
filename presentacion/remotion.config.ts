// Render del deck a MP4 (versión que avanza sola, para enviar o subir).
// La charla en vivo usa el Player (`npm run dev`), no este archivo.
import { Config } from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');
// PNG antes de codificar: JPEG deja bandas en los fondos oscuros con degradado.
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setOverwriteOutput(true);
