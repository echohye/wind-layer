import { UserConfig } from 'vitest';

const config: { test: UserConfig } = {
  test: {
    testTimeout: 50000,
    coverage: {
      reporter: ['lcov', 'html'],
    } as any,
  },
}

export default config;
