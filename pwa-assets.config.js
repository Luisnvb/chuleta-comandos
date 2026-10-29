import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Regenerate icons after editing public/favicon.svg: npm run generate-icons
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: '#2f6fde' },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: '#2f6fde' },
    },
  },
  images: ['public/favicon.svg'],
});
