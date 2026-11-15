import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // `npx wrangler pages dev dist --port 8788` serves the leaderboard API locally
  server: { proxy: { '/api': 'http://127.0.0.1:8788' } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
});
