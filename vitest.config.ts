import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,       // 30 s max par test (appels Supabase)
    hookTimeout: 15_000,       // 15 s pour beforeAll / afterAll
    include: ['tests/**/*.test.ts'],
    reporters: ['verbose'],
  },
})
