import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    headers: {
      'Permissions-Policy': 'camera=(self)',
    },
  },
  preview: {
    allowedHosts: ['party.ibuildnothing.com'],
    headers: {
      'Permissions-Policy': 'camera=(self)',
    },
  },
  worker: {
    format: 'es',
  },
});
