import { URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), svgLoader()],
  base: './',
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @use "@/assets/scss/index.scss" as *;
        `,
      },
    },
  },
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, './src/components'),
      '@plugins': path.resolve(__dirname, './src/plugins'),
      '@src': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
