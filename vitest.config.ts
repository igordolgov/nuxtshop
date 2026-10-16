import { defineConfig } from 'vitest/config';

// Юнит-тесты серверной логики. Окружение node: тестируем чистые модули
// (server/lib), KV/h3/telegram мокируются в самих тест-файлах.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
