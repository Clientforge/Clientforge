import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/grace-to-grace/',
  plugins: [react()],
  server: {
    proxy: {
      '/vpic-api': {
        target: 'https://vpic.nhtsa.dot.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vpic-api/, '/api'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
