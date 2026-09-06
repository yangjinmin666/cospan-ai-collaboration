import { defineConfig } from 'vite';
import uniModule from '@dcloudio/vite-plugin-uni';
// DCloud's published plugin is CJS; Node's native ESM interop adds a default layer.
const uni = (uniModule as unknown as { default?: typeof uniModule }).default || uniModule;
export default defineConfig({ base: './', plugins: [uni()], server: { host: '127.0.0.1', port: 4180, strictPort: true } });
