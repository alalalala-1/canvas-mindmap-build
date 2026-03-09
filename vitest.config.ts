import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
		environment: 'node',
		globals: true,
	},
	resolve: {
		alias: {
			obsidian: new URL('./src/__mocks__/obsidian.ts', import.meta.url).pathname,
		},
	},
});