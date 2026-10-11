import { createRouter, createWebHistory } from 'vue-router';
import type { Permiso } from '@/modules/usuarios/contrato';
import {
  type UsuarioSesion,
  claveSesion,
  consultaSesion,
} from '@/web/features/sesion/api/sesion.api';
import { avisarSiSePierdeLaSesion, queryClient } from '@/web/shared/lib/query';
import { seccionesDe, tieneAcceso } from './secciones';

declare module 'vue-router' {
  interface RouteMeta {
    titulo: string;
    /** Pantalla completa, sin la barra lateral (el check-in, el ingreso). */
    kiosco?: boolean;
    /** Se ve sin haber iniciado sesión. Solo la pantalla de ingreso. */
    publica?: boolean;
    /** Accesos que abren esta pantalla: alcanza con tener uno. */
    permisos?: readonly Permiso[];
    /** Solo para el dueño. No se delega. */
    soloDueno?: boolean;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // A dónde va cada uno al entrar lo decide el guard, según sus accesos.
    {
      path: '/',
      name: 'inicio',
      component: () => import('@/web/shared/layout/SinAccesoView.vue'),
      meta: { titulo: 'Inicio' },
    },
    {
      path: '/ingresar',
      name: 'ingresar',
      component: () => import('@/web/features/sesion/views/IngresarView.vue'),
      meta: { titulo: 'Ingresar', kiosco: true, publica: true },
    },
    {
      path: '/sin-acceso',
      name: 'sin-acceso',
      component: () => import('@/web/shared/layout/SinAccesoView.vue'),
      meta: { titulo: 'Sin acceso' },
    },
    {
      path: '/clientes',
      name: 'clientes',
      component: () => import('@/web/features/clientes/views/ClientesListaView.vue'),
      meta: { titulo: 'Clientes', permisos: ['clientes.gestionar', 'membresias.vender'] },
    },
    {
      path: '/clientes/nuevo',
      name: 'cliente-nuevo',
      component: () => import('@/web/features/clientes/views/ClienteFormView.vue'),
      meta: { titulo: 'Registrar cliente', permisos: ['clientes.gestionar'] },
    },
    {
      path: '/clientes/:id(\\d+)',
      name: 'cliente-ficha',
      component: () => import('@/web/features/clientes/views/ClienteFichaView.vue'),
      meta: {
        titulo: 'Ficha del cliente',
        permisos: ['clientes.gestionar', 'membresias.vender'],
      },
    },
    {
      path: '/clientes/:id(\\d+)/editar',
      name: 'cliente-editar',
      component: () => import('@/web/features/clientes/views/ClienteFormView.vue'),
      meta: { titulo: 'Editar cliente', permisos: ['clientes.gestionar'] },
    },
    {
      path: '/clientes/:id(\\d+)/membresias/nueva',
      name: 'membresia-nueva',
      component: () => import('@/web/features/membresias/views/MembresiaVentaView.vue'),
      meta: { titulo: 'Vender membresía', permisos: ['membresias.vender'] },
    },
    {
      path: '/pagos',
      name: 'pagos',
      component: () => import('@/web/features/pagos/views/PagosView.vue'),
      meta: { titulo: 'Pagos', permisos: ['pagos.caja_hoy', 'pagos.otras_fechas'] },
    },
    {
      path: '/visitas',
      name: 'visitas',
      component: () => import('@/web/features/visitas/views/VisitasView.vue'),
      meta: { titulo: 'Visitas', permisos: ['visitas.gestionar'] },
    },
    {
      path: '/reportes',
      name: 'reportes',
      component: () => import('@/web/features/reportes/views/ReportesView.vue'),
      meta: { titulo: 'Reportes', permisos: ['reportes.ver'] },
    },
    {
      path: '/usuarios',
      name: 'usuarios',
      component: () => import('@/web/features/usuarios/views/UsuariosView.vue'),
      meta: { titulo: 'Usuarios', soloDueno: true },
    },
    {
      path: '/usuarios/nuevo',
      name: 'usuario-nuevo',
      component: () => import('@/web/features/usuarios/views/UsuarioFormView.vue'),
      meta: { titulo: 'Crear usuario', soloDueno: true },
    },
    {
      path: '/usuarios/:id(\\d+)',
      name: 'usuario-editar',
      component: () => import('@/web/features/usuarios/views/UsuarioFormView.vue'),
      meta: { titulo: 'Editar usuario', soloDueno: true },
    },
    {
      path: '/checkin',
      name: 'checkin',
      component: () => import('@/web/features/checkin/views/CheckinView.vue'),
      meta: { titulo: 'Check-in', kiosco: true, permisos: ['checkin.usar'] },
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

/**
 * Antes de cada pantalla: ¿hay alguien adentro, y puede verla?
 *
 * Esto ordena la navegación; la seguridad de verdad está en el servidor, que
 * revisa cada pedido por su cuenta.
 */
router.beforeEach(async (a) => {
  let usuario: UsuarioSesion | null;
  try {
    usuario = await queryClient.fetchQuery(consultaSesion);
  } catch {
    // El servidor no contesta. Se deja pasar: la pantalla va a mostrar su
    // propio error de carga, con el botón para reintentar.
    return true;
  }

  if (a.meta.publica) return usuario ? { name: 'inicio' } : true;

  if (!usuario) {
    return { name: 'ingresar', query: a.path === '/' ? {} : { volver: a.fullPath } };
  }

  if (a.name === 'inicio') {
    const primera = seccionesDe(usuario)[0];
    return primera ? { name: primera.ruta } : { name: 'sin-acceso' };
  }

  if (!tieneAcceso(usuario, a.meta)) return { name: 'sin-acceso' };

  return true;
});

router.afterEach((a) => {
  document.title = `${a.meta.titulo} · Gimnasio`;
});

// La sesión venció, o el dueño desactivó la cuenta, en medio del uso.
avisarSiSePierdeLaSesion(() => {
  const actual = router.currentRoute.value;
  if (actual.meta.publica) return;

  queryClient.setQueryData(claveSesion, null);
  void router.replace({
    name: 'ingresar',
    query: { volver: actual.fullPath, motivo: 'vencida' },
  });
});
