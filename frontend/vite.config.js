import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/models': 'http://localhost:4000',
      '/chat': 'http://localhost:4000',
      '/video': 'http://localhost:4000',
      '/plugins': 'http://localhost:4000',
      '/health': 'http://localhost:4000'
    }
  }
});
