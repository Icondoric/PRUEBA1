import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';
import { z } from 'zod';
import { es } from 'zod/locales';
import App from './App.vue';
import { router } from './router';
import { ErrorDeApi } from './shared/lib/api';
import './styles.css';

// Los mensajes por defecto de Zod, en español. Los formularios comparten los
// esquemas del servidor, así que lo que no tenga mensaje propio sale de acá.
z.config(es());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Un 404 o un 422 no se arreglan reintentando: se muestran enseguida.
      // Solo se reintenta lo que puede ser pasajero (5xx, servidor reiniciando).
      retry: (intentos, error) =>
        !(error instanceof ErrorDeApi && error.status < 500) && intentos < 2,
      staleTime: 10_000,
    },
  },
});

createApp(App).use(VueQueryPlugin, { queryClient }).use(router).mount('#app');
