import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Installer outputs and exported HTML are not app source. Watching them
    // can reload the editor or hit Windows locks while packaging.
    watch: { ignored: ['**/release/**'] }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
