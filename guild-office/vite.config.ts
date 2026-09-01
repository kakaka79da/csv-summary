import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Vite + Vitest 설정. `@/` 를 src/ 로 매핑해 임포트 경로를 짧게 유지한다.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // 테스트는 순수 로직(상태 머신 / 경로탐색 / 예산)만 다루므로 jsdom 이 필요 없다.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
