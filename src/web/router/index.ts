import { createRouter, createWebHistory } from 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    titulo: string;
    /** Pantalla completa, sin la barra lateral (el check-in). */
    kiosco?: boolean;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: { name: 'clientes' } },
    {
      path: '/clientes',
      name: 'clientes',
      component: () => import('@/web/features/clientes/views/ClientesListaView.vue'),
      meta: { titulo: 'Clientes' },
    },
    {
      path: '/clientes/nuevo',
      name: 'cliente-nuevo',
      component: () => import('@/web/features/clientes/views/ClienteFormView.vue'),
      meta: { titulo: 'Registrar cliente' },
    },
    {
      path: '/clientes/:id(\\d+)',
      name: 'cliente-ficha',
      component: () => import('@/web/features/clientes/views/ClienteFichaView.vue'),
      meta: { titulo: 'Ficha del cliente' },
    },
    {
      path: '/clientes/:id(\\d+)/editar',
      name: 'cliente-editar',
      component: () => import('@/web/features/clientes/views/ClienteFormView.vue'),
      meta: { titulo: 'Editar cliente' },
    },
    {
      path: '/clientes/:id(\\d+)/membresias/nueva',
      name: 'membresia-nueva',
      component: () => import('@/web/features/membresias/views/MembresiaVentaView.vue'),
      meta: { titulo: 'Vender membresía' },
    },
    {
      path: '/checkin',
      name: 'checkin',
      component: () => import('@/web/features/checkin/views/CheckinView.vue'),
      meta: { titulo: 'Check-in', kiosco: true },
    },
    {
      path: '/:resto(.*)*',
      name: 'no-encontrada',
      component: () => import('@/web/shared/layout/NoEncontradaView.vue'),
      meta: { titulo: 'Página no encontrada' },
    },
  ],
  // Volver atrás deja la lista donde estaba; una pantalla nueva empieza arriba.
  scrollBehavior: (_a, _de, guardada) => guardada ?? { top: 0 },
});

router.afterEach((a) => {
  document.title = `${a.meta.titulo} · Gimnasio`;
});
