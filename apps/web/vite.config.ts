import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: { manualChunks: (id) => (id.includes('/three/') ? 'three' : undefined) },
    },
  },
});
