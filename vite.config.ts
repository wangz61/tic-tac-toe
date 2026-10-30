import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built dist/ works from any static server path.
  base: './',
  server: {
    // Online play: forward the WebSocket to the Python server (uvicorn on :8000).
    proxy: { '/ws': { target: 'ws://127.0.0.1:8000', ws: true } },
  },
});
