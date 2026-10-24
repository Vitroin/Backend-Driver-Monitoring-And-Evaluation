import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Set before the app's modules load, so they win over .env (which never overrides variables already set)
    env: {
      NODE_ENV: 'test',
      DB_URL: process.env.E2E_DB_URL ?? 'mongodb://127.0.0.1:27017/sahi_e2e?replicaSet=rs0',
    },
    // One app and one database: the files must not run at the same time
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
