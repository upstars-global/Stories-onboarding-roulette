import { createApp, type App as VueApp } from 'vue';
import App from './App.vue';
import { detectVideoFormats } from '@/composables/useVideoFormat';

const app: VueApp = createApp(App);
// The first slide mounts with its <source> list, so the format has to be known
// before that. The check takes a few milliseconds; mount either way.
detectVideoFormats().finally(() => app.mount('#app'));
