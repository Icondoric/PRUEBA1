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

import { ConflictoError, NoEncontradoError } from '@/lib/errors';
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
import type {
  ClienteFila,
  FiltroBusqueda,
  RepoClientes,
} from '../infrastructure/clientes.repo';

export interface ClienteVista extends ClienteFila {
  nombreCompleto: string;
  tipo: TipoCliente;
}

export function crearServicioClientes(repo: RepoClientes) {
  function decorar(fila: ClienteFila): ClienteVista {
    return {
      ...fila,
      nombreCompleto: nombreCompleto(fila),
      tipo: tipoCliente(repo.membresiasResumen(fila.id)),
    };
  }

  return {
    registrar(
      datos: DatosNuevoCliente & { referidoPorClienteId?: number | null },
      hoy: FechaISO,
    ): ClienteVista {
      const normalizado = prepararAlta(datos);

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
        referidoPorClienteId: datos.referidoPorClienteId ?? null,
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

    listar(filtro: FiltroBusqueda) {
      const { filas, total } = repo.buscar(filtro);
      return {
        clientes: filas.map(decorar),
        total,
        pagina: filtro.pagina,
        porPagina: filtro.porPagina,
        paginas: Math.max(1, Math.ceil(total / filtro.porPagina)),
      };
    },

    actualizar(id: number, datos: DatosNuevoCliente): ClienteVista {
      if (!repo.porId(id)) throw new NoEncontradoError('el cliente', id);

      const normalizado = prepararAlta(datos);

      if (normalizado.ci) {
        const otro = repo.porCi(normalizado.ci, normalizado.ciExtension!);
        if (otro && otro.id !== id) {
          throw new ConflictoError(
            `Ese CI ya está registrado a nombre de ${nombreCompleto(otro)}`,
            { clienteId: otro.id },
          );
        }
      }

      const fila = repo.actualizar(id, normalizado);
      if (!fila) throw new NoEncontradoError('el cliente', id);
      return decorar(fila);
    },

    desactivar(id: number): void {
      if (!repo.porId(id)) throw new NoEncontradoError('el cliente', id);
      repo.desactivar(id);
    },
  };
}

export type ServicioClientes = ReturnType<typeof crearServicioClientes>;
