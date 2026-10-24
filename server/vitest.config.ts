import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      JWT_SECRET: 'test-secret-with-more-than-16-chars',
      AI_SERVICE_URL: 'http://127.0.0.1:1',
    },
    testTimeout: 20000,
  },
});
