import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { seoPages } from './scripts/seo-pages';

/**
 * El arranque del splash (src/splash/boot.ts) en su propio chunk, antes del paquete principal: el 3D
 * no espera a que baje 1 MB de JS. Vite junta en uno todos los módulos que nombra el HTML, así que al
 * compilar se emite aparte y se escribe la etiqueta en el HTML ya generado.
 */
function splashBoot(): Plugin {
  const mark = '<!-- splash:boot -->';
  // async: los módulos normales se ejecutan en orden, y este iría después del paquete principal.
  const tag = (src: string) => `<script type="module" async src="${src}"></script>`;
  let serve = false;
  let ref = '';
  return {
    name: 'noutlife-splash-boot',
    enforce: 'post',
    configResolved(config) {
      serve = config.command === 'serve';
    },
    buildStart() {
      if (!serve) ref = this.emitFile({ type: 'chunk', id: path.resolve(__dirname, 'src/splash/boot.ts'), name: 'splash' });
    },
    transformIndexHtml(html) {
      return serve ? html.replace(mark, tag('/src/splash/boot.ts')) : html;
    },
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset' || !String(index.source).includes(mark)) throw new Error('[splash] el index.html compilado no tiene la marca');
      index.source = String(index.source).replace(mark, tag(`/${this.getFileName(ref)}`));
    },
  };
}

export default defineConfig({
  // seoPages: HTML estático de /en y /es con la cabecera de su idioma (enlaces compartidos y Google).
  plugins: [react(), splashBoot(), seoPages()],
  resolve: {
    alias: {
      '@noutlife/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false,
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app'],
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
