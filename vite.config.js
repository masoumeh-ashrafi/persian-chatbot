import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// در حالت توسعه، درخواست‌های /api به سرور Express (پورت ۳۰۰۱) فرستاده می‌شن.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: `http://localhost:${process.env.PORT || 3001}`, changeOrigin: true },
    },
  },
});
