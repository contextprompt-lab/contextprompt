import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'bin/contextprompt.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
  splitting: false,
});
