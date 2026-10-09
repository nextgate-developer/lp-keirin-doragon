import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://lp.keirin-dragon.com',
  output: 'static',
  publicDir: './.generated-public',
  outDir: process.env.KD_BUILD_DIR || './dist',
  build: { format: 'file' },
});
