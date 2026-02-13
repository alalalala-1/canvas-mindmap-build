import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
		environment: 'node',
		globals: true,
	},
	resolve: {
		alias: {
			obsidian: resolve(__dirname, 'src/__mocks__/obsidian.ts'),
		},
	},
});
