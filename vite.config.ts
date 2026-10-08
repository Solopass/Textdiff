import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // Relative base so the built assets resolve correctly on GitHub Pages
    // project sites (username.github.io/repo-name) regardless of repo name.
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Only React is grouped by hand. Everything else is left to
          // Rollup's own splitting, which derives chunks from the dynamic
          // import() boundaries in the source.
          //
          // Naming a chunk here does NOT make it load lazily — laziness comes
          // purely from how a module is imported. Worse, forcing a library
          // into a named chunk can pull it into the entry's static graph and
          // get it <link rel="modulepreload">-ed, which is how an earlier
          // version of this config ended up eagerly downloading ~580KB of
          // export libraries that almost nobody uses. Leave the heavy,
          // action-triggered dependencies (firebase, jspdf, html2canvas,
          // socket.io) alone so they stay async.
          manualChunks(id) {
            const normalized = id.replace(/\\/g, '/');
            if (!normalized.includes('/node_modules/')) return;
            if (
              normalized.includes('/node_modules/react/') ||
              normalized.includes('/node_modules/react-dom/') ||
              normalized.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
          },
        },
      },
      chunkSizeWarningLimit: 700,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
      testTimeout: 15000,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
