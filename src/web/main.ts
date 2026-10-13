import { VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';
import { z } from 'zod';
import { es } from 'zod/locales';
import App from './App.vue';
import { router } from './router';
import { queryClient } from './shared/lib/query';
import './styles.css';

// Los mensajes por defecto de Zod, en español. Los formularios comparten los
// esquemas del servidor, así que lo que no tenga mensaje propio sale de acá.
z.config(es());

createApp(App).use(VueQueryPlugin, { queryClient }).use(router).mount('#app');
