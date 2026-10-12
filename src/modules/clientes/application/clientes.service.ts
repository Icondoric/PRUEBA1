/**
 * CAPA APPLICATION — casos de uso.
 *
 * Orquesta: llama al dominio para decidir, al repositorio para persistir.
 * No tiene SQL ni sabe de HTTP. Es la capa que leés para entender QUÉ hace el
 * sistema, sin ruido de infraestructura.
 *
 * Recibe sus dependencias por parámetro (el repo, `hoy`). Así los tests no
 * necesitan levantar nada ni congelar el reloj.
 */

import {
  ConflictoError,
  NoEncontradoError,
  ReglaDeNegocioError,
  SinPermisoError,
} from '@/lib/errors';
import type { FechaISO } from '@/lib/fechas';
import {
  type DatosNuevoCliente,
  type TipoCliente,
  nombreCompleto,
  normalizarIdentificador,
  prepararAlta,
  siguienteNroSocio,
  tipoCliente,
} from '../domain/cliente';
import { prepararBloqueo } from '../domain/bloqueo';
import type {
  ClienteFila,
  FiltroBusqueda,
  RepoClientes,
} from '../infrastructure/clientes.repo';

export interface ClienteVista extends ClienteFila {
  nombreCompleto: string;
  tipo: TipoCliente;
  /** Quién lo bloqueó. null si no está bloqueado (o si se bloqueó antes de registrarlo). */
  bloqueadoPorNombre: string | null;
}

export interface DatosDeCliente extends DatosNuevoCliente {
  /** Quién lo trajo, ya resuelto (lo usan los scripts). */
  referidoPorClienteId?: number | null;
  /**
   * Quién lo trajo, como se teclea en el formulario: nº de socio o CI.
   * Vacío = nadie. Si no viene, al editar no se toca.
   */
  referidoPor?: string | null;
}

export function crearServicioClientes(repo: RepoClientes) {
  function decorar(fila: ClienteFila): ClienteVista {
    return {
      ...fila,
      nombreCompleto: nombreCompleto(fila),
      tipo: tipoCliente(repo.membresiasResumen(fila.id)),
      bloqueadoPorNombre:
        fila.bloqueado && fila.bloqueadoPor !== null
          ? repo.nombreDeUsuario(fila.bloqueadoPor)
          : null,
    };
  }

  /**
   * De "lo que se tecleó" a un cliente. `undefined` = no vino el dato (al
   * editar, no se toca); `null` = se dejó vacío a propósito.
   */
  function resolverReferido(datos: DatosDeCliente, propioId?: number) {
    if (datos.referidoPor === undefined || datos.referidoPor === null) {
      return datos.referidoPorClienteId;
    }

    const texto = datos.referidoPor.trim();
    if (!texto) return null;

    const padrino = repo.porIdentificador(normalizarIdentificador(texto));
    if (!padrino) {
      throw new ReglaDeNegocioError(
        `“${texto}” no es un número de socio ni un CI registrado`,
        { campo: 'referidoPor' },
      );
    }
    if (padrino.id === propioId) {
      throw new ReglaDeNegocioError('Un cliente no puede referirse a sí mismo', {
        campo: 'referidoPor',
      });
    }
    return padrino.id;
  }

  return {
    registrar(datos: DatosDeCliente, hoy: FechaISO): ClienteVista {
      const normalizado = prepararAlta(datos);
      // Antes de guardar nada: si el referido no existe, no se crea el cliente.
      const referidoPorClienteId = resolverReferido(datos) ?? null;

      // Un CI repetido es la forma número uno de duplicar un socio.
      if (normalizado.ci) {
        const existente = repo.porCi(normalizado.ci, normalizado.ciExtension!);
        if (existente) {
          throw new ConflictoError(
            `Ese CI ya está registrado a nombre de ${nombreCompleto(existente)} (socio ${existente.nroSocio})`,
            { clienteId: existente.id, nroSocio: existente.nroSocio },
          );
        }
      }

      const fila = repo.insertar({
        ...normalizado,
        nroSocio: siguienteNroSocio(repo.maximoNroSocio()),
        fechaRegistro: hoy,
        referidoPorClienteId,
      });

      return decorar(fila);
    },

    obtener(id: number): ClienteVista {
      const fila = repo.porId(id);
      if (!fila) throw new NoEncontradoError('el cliente', id);
      return decorar(fila);
    },

    /** Lo que usa el check-in y la venta rápida de pases. */
    buscarPorIdentificador(entrada: string): ClienteVista | null {
      const fila = repo.porIdentificador(normalizarIdentificador(entrada));
      return fila ? decorar(fila) : null;
    },

    /**
     * @param puedeVerBajas los dados de baja los ve quien puede reactivarlos.
     */
    listar(filtro: FiltroBusqueda, puedeVerBajas = false) {
      if (filtro.deBaja && !puedeVerBajas) {
        throw new SinPermisoError('Tu usuario no puede ver a los clientes dados de baja');
      }
      const { filas, total } = repo.buscar(filtro);
      return {
        clientes: filas.map(decorar),
        total,
        pagina: filtro.pagina,
        porPagina: filtro.porPagina,
        paginas: Math.max(1, Math.ceil(total / filtro.porPagina)),
      };
    },

    actualizar(id: number, datos: DatosDeCliente): ClienteVista {
      if (!repo.porId(id)) throw new NoEncontradoError('el cliente', id);

      const normalizado = prepararAlta(datos);
      const referido = resolverReferido(datos, id);

      if (normalizado.ci) {
        const otro = repo.porCi(normalizado.ci, normalizado.ciExtension!);
        if (otro && otro.id !== id) {
          throw new ConflictoError(
            `Ese CI ya está registrado a nombre de ${nombreCompleto(otro)}`,
            { clienteId: otro.id },
          );
        }
      }

      const fila = repo.actualizar(
        id,
        referido === undefined
          ? normalizado
          : { ...normalizado, referidoPorClienteId: referido },
      );
      if (!fila) throw new NoEncontradoError('el cliente', id);
      return decorar(fila);
    },

    /**
     * Bloqueo manual: rebota en el check-in aunque tenga la membresía al día.
     * Queda registrado quién lo bloqueó y cuándo.
     */
    bloquear(id: number, motivo: string, usuarioId: number, ahora: Date): ClienteVista {
      if (!repo.porId(id)) throw new NoEncontradoError('el cliente', id);
      repo.bloquear(id, prepararBloqueo(motivo), usuarioId, ahora);
      return this.obtener(id);
    },

    desbloquear(id: number): ClienteVista {
      if (!repo.porId(id)) throw new NoEncontradoError('el cliente', id);
      repo.desbloquear(id);
      return this.obtener(id);
    },

    /** Deshace una baja. El cliente vuelve con todo su historial. */
    reactivar(id: number): ClienteVista {
      if (!repo.porId(id)) throw new NoEncontradoError('el cliente', id);
      repo.reactivar(id);
      return this.obtener(id);
    },

    /**
     * Dar de baja. NO borra nada: el cliente y todo su historial quedan
     * guardados; deja de aparecer en las listas y no puede entrar.
     */
    desactivar(id: number): void {
      if (!repo.porId(id)) throw new NoEncontradoError('el cliente', id);
      repo.desactivar(id);
    },
  };
}

export type ServicioClientes = ReturnType<typeof crearServicioClientes>;
