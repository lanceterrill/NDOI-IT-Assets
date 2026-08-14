import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ command }) => ({
  base: '/NDOI-IT-Assets/',
  server: command === 'serve' ? {
    https: {
      key: fs.readFileSync(path.resolve(import.meta.dirname, '../backend/certs/key.pem')),
      cert: fs.readFileSync(path.resolve(import.meta.dirname, '../backend/certs/cert.pem')),
    },
  } : undefined,
}));
