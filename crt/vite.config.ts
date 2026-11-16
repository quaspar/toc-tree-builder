/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> dist/        multi-file build, deployed to GitHub Pages
// `npm run build:single` -> dist-single/ one self-contained index.html that also works from file://
export default defineConfig(({ mode }) => ({
  // Relative base so the build works under https://<user>.github.io/<repo>/ and from any sub-path.
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
  },
}));
