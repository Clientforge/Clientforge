import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const g2gBase = process.env.VITE_G2G_BASE || '/grace-to-grace/';
const g2gOutDir = process.env.VITE_G2G_OUT_DIR || 'dist';

export default defineConfig({
  base: g2gBase.endsWith('/') ? g2gBase : `${g2gBase}/`,
  plugins: [react()],
  server: {
    proxy: {
      '/vpic-api': {
        target: 'https://vpic.nhtsa.dot.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vpic-api/, '/api'),
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: g2gOutDir,
    sourcemap: false,
  },
});
