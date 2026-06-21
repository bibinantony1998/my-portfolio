import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    base: '/my-portfolio/', // Use relative paths for assets
    server: {
        port: 3000,
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                familyCommandCenter: resolve(__dirname, 'family-command-center.html'),
                otherTalents: resolve(__dirname, 'other-talents.html'),
            },
        },
        chunkSizeWarningLimit: 1000,
    },
    publicDir: 'public',
});
