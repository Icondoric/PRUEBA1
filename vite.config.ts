import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Un solo config para las dos salidas de `pnpm build`:
//   vite build                            → dist/web     (la SPA)
//   vite build --ssr src/server/main.ts   → dist/server  (el proceso Node)
// El build SSR resuelve el alias `@/` y deja las dependencias como externas,
// así que better-sqlite3 se sigue cargando desde node_modules.
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    outDir: isSsrBuild ? 'dist/server' : 'dist/web',
    emptyOutDir: true,
    target: isSsrBuild ? 'node22' : undefined,
  },
}));
