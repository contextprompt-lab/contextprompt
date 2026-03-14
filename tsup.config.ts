import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'bin/meetcode.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
  splitting: false,
});
