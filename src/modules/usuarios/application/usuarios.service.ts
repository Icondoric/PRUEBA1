/**
 * CAPA APPLICATION — usuarios, sesiones y accesos.
 *
 *   iniciarSesion / sesionDe / cerrarSesion   quién está usando el sistema
 *   listar / crear / actualizar / cambiarPassword   lo que administra el dueño
 *   asegurarDueno   la cuenta del dueño (la usa el comando, no una pantalla)
 *
 * El reloj (`ahora`) entra por parámetro. Acá sí es una hora real y no una
 * fecha de calendario: una sesión vence por tiempo transcurrido.
 */

import {
  ConflictoError,
  NoAutenticadoError,
  NoEncontradoError,
  ReglaDeNegocioError,
} from '@/lib/errors';
import {
  INTENTOS_ANTES_DE_BLOQUEAR,
  type IntentosFallidos,
  normalizarUsuario,
  segundosDeEspera,
  sesionVigente,
  validarNombre,
  validarPassword,
  validarUsuario,
} from '../domain/credenciales';
import {
  CATALOGO_DE_ACCESOS,
  PERMISOS_BASICOS,
  type Permiso,
  type Rol,
  esPermiso,
  permisosEfectivos,
} from '../domain/permisos';
import type { RepoUsuarios, UsuarioFila } from '../infrastructure/usuarios.repo';
import { hashDeToken, hashearPassword, nuevoToken, passwordCoincide } from './password';

/** Quien está usando el sistema en este pedido. */
export interface UsuarioSesion {
  id: number;
  usuario: string;
  nombre: string;
  rol: Rol;
  /** Lo que puede hacer. El dueño, todo. */
  permisos: Permiso[];
}

/** La sesión no se "toca" en cada pedido: con una vez por minuto alcanza. */
const SEGUNDOS_ENTRE_TOQUES = 60;

const CREDENCIALES_INCORRECTAS = 'Usuario o contraseña incorrectos';

export function crearServicioUsuarios(
  repo: RepoUsuarios,
  config: { horasDeSesion: number },
) {
  // Intentos fallidos por nombre de usuario. En memoria: se reinicia con el
  // proceso, que es un único proceso en una única PC.
  const fallidos = new Map<string, IntentosFallidos>();

  function aSesion(fila: UsuarioFila): UsuarioSesion {
    return {
      id: fila.id,
      usuario: fila.usuario,
      nombre: fila.nombre,
      rol: fila.rol,
      permisos: permisosEfectivos(fila.rol, repo.permisosDe(fila.id)),
    };
  }

  function aVista(fila: UsuarioFila, guardados: string[]) {
    return {
      id: fila.id,
      usuario: fila.usuario,
      nombre: fila.nombre,
      rol: fila.rol,
      activo: fila.activo,
      permisos: permisosEfectivos(fila.rol, guardados),
    };
  }

  function permisosValidos(pedidos: readonly string[]): Permiso[] {
    const desconocido = pedidos.find((p) => !esPermiso(p));
    if (desconocido !== undefined) {
      throw new ReglaDeNegocioError(`Ese acceso no existe: ${desconocido}`, {
        campo: 'permisos',
      });
    }
    return pedidos.filter(esPermiso);
  }

  function buscar(id: number): UsuarioFila {
    const fila = repo.porId(id);
    if (!fila) throw new NoEncontradoError('el usuario', id);
    return fila;
  }

  return {
    // ── sesión ──────────────────────────────────────────────────────────────

    iniciarSesion(entrada: { usuario: string; password: string }, ahora: Date) {
      const usuario = normalizarUsuario(entrada.usuario);

      const espera = segundosDeEspera(fallidos.get(usuario), ahora);
      if (espera > 0) {
        throw new NoAutenticadoError(
          `Demasiados intentos seguidos. Esperá ${espera} segundos y probá de nuevo.`,
        );
      }

      const fila = repo.porUsuario(usuario);
      // El mismo mensaje si el usuario no existe, está desactivado o la
      // contraseña está mal: no se le dice a un curioso qué cuentas existen.
      if (
        !fila ||
        !fila.activo ||
        !passwordCoincide(entrada.password, fila.passwordHash)
      ) {
        const previos = fallidos.get(usuario);
        // Si ya había llegado al límite y cumplió la espera, la cuenta vuelve a
        // empezar. Antes del límite los intentos se acumulan.
        const vencido =
          previos !== undefined &&
          previos.cantidad >= INTENTOS_ANTES_DE_BLOQUEAR &&
          segundosDeEspera(previos, ahora) === 0;
        fallidos.set(usuario, {
          cantidad: (previos && !vencido ? previos.cantidad : 0) + 1,
          ultimo: ahora,
        });
        throw new NoAutenticadoError(CREDENCIALES_INCORRECTAS);
      }

      fallidos.delete(usuario);

      const token = nuevoToken();
      repo.crearSesion({
        tokenHash: hashDeToken(token),
        usuarioId: fila.id,
        ultimoUso: ahora,
      });

      return { token, usuario: aSesion(fila) };
    },

    /** Quién es el dueño de este token. null si no vale (o ya venció). */
    sesionDe(token: string | undefined, ahora: Date): UsuarioSesion | null {
      if (!token) return null;

      const sesion = repo.sesionPorToken(hashDeToken(token));
      if (!sesion) return null;

      if (!sesionVigente(sesion.ultimoUso, ahora, config.horasDeSesion)) {
        repo.borrarSesion(sesion.id);
        return null;
      }

      const fila = repo.porId(sesion.usuarioId);
      if (!fila || !fila.activo) {
        repo.borrarSesion(sesion.id);
        return null;
      }

      if (ahora.getTime() - sesion.ultimoUso.getTime() > SEGUNDOS_ENTRE_TOQUES * 1000) {
        repo.tocarSesion(sesion.id, ahora);
      }

      return aSesion(fila);
    },

    cerrarSesion(token: string | undefined): void {
      if (!token) return;
      const sesion = repo.sesionPorToken(hashDeToken(token));
      if (sesion) repo.borrarSesion(sesion.id);
    },

    /**
     * Cada uno cambia su propia contraseña. Pide la actual: una sesión abierta
     * y olvidada en la PC de recepción no alcanza para quedarse con la cuenta.
     * Cierra todas las sesiones de esa cuenta, también la de quien la cambió.
     */
    cambiarMiPassword(
      usuarioId: number,
      entrada: { actual: string; nueva: string },
    ): void {
      const fila = buscar(usuarioId);
      if (!passwordCoincide(entrada.actual, fila.passwordHash)) {
        throw new ReglaDeNegocioError('La contraseña actual no es esa', {
          campo: 'actual',
        });
      }
      repo.actualizar(usuarioId, {
        passwordHash: hashearPassword(validarPassword(entrada.nueva)),
      });
      repo.borrarSesionesDe(usuarioId);
    },

    // ── lo que administra el dueño ──────────────────────────────────────────

    catalogo() {
      return { catalogo: CATALOGO_DE_ACCESOS, basicos: [...PERMISOS_BASICOS] };
    },

    listar() {
      const guardados = repo.todosLosPermisos();
      return repo.listar().map((fila) =>
        aVista(
          fila,
          guardados.filter((g) => g.usuarioId === fila.id).map((g) => g.permiso),
        ),
      );
    },

    obtener(id: number) {
      const fila = buscar(id);
      return aVista(fila, repo.permisosDe(id));
    },

    /** Crea un usuario de recepción. El dueño no se crea desde acá. */
    crear(
      entrada: { usuario: string; nombre: string; password: string; permisos?: string[] },
      actorId: number,
    ) {
      const usuario = validarUsuario(entrada.usuario);
      const nombre = validarNombre(entrada.nombre);
      const password = validarPassword(entrada.password);
      const permisos = permisosValidos(entrada.permisos ?? PERMISOS_BASICOS);

      if (repo.porUsuario(usuario)) {
        throw new ConflictoError(`Ya existe un usuario "${usuario}"`, {
          campo: 'usuario',
        });
      }

      const fila = repo.insertar({
        usuario,
        nombre,
        passwordHash: hashearPassword(password),
        rol: 'recepcion',
      });
      repo.reemplazarPermisos(fila.id, permisos, actorId);

      return aVista(fila, permisos);
    },

    actualizar(
      id: number,
      cambios: { nombre?: string; activo?: boolean; permisos?: string[] },
      actorId: number,
    ) {
      const fila = buscar(id);

      if (
        fila.rol === 'admin' &&
        (cambios.activo === false || cambios.permisos !== undefined)
      ) {
        throw new ReglaDeNegocioError(
          'La cuenta del dueño tiene todos los accesos y no se puede desactivar desde acá',
        );
      }

      const nombre =
        cambios.nombre === undefined ? fila.nombre : validarNombre(cambios.nombre);
      const activo = cambios.activo ?? fila.activo;

      repo.actualizar(id, { nombre, activo });

      if (cambios.permisos !== undefined) {
        repo.reemplazarPermisos(id, permisosValidos(cambios.permisos), actorId);
      }
      // Desactivado = afuera ya, no cuando se le venza la sesión.
      if (!activo) repo.borrarSesionesDe(id);

      return aVista({ ...fila, nombre, activo }, repo.permisosDe(id));
    },

    /** Cambia la contraseña y cierra todas las sesiones de esa cuenta. */
    cambiarPassword(id: number, password: string): void {
      buscar(id);
      repo.actualizar(id, { passwordHash: hashearPassword(validarPassword(password)) });
      repo.borrarSesionesDe(id);
    },

    /**
     * Crea la cuenta del dueño, o le pone contraseña nueva si ya existe (y la
     * reactiva). La usa `pnpm usuarios:dueno`: es la llave de emergencia.
     */
    asegurarDueno(entrada: { usuario: string; nombre: string; password: string }) {
      const usuario = validarUsuario(entrada.usuario);
      const nombre = validarNombre(entrada.nombre);
      const passwordHash = hashearPassword(validarPassword(entrada.password));

      const existente = repo.porUsuario(usuario);
      if (existente) {
        repo.actualizar(existente.id, {
          nombre,
          passwordHash,
          rol: 'admin',
          activo: true,
        });
        repo.borrarSesionesDe(existente.id);
        return { id: existente.id, usuario, creado: false };
      }

      const fila = repo.insertar({ usuario, nombre, passwordHash, rol: 'admin' });
      return { id: fila.id, usuario, creado: true };
    },
  };
}

export type ServicioUsuarios = ReturnType<typeof crearServicioUsuarios>;
export type UsuarioVista = ReturnType<ServicioUsuarios['obtener']>;
export type CatalogoDeAccesos = ReturnType<ServicioUsuarios['catalogo']>;
