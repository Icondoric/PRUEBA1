/**
 * CAPA APPLICATION — casos de uso de pagos: el historial con sus totales de
 * caja, los pagos de un cliente, y anular.
 */

import { NoEncontradoError } from '@/lib/errors';
import type { FechaISO } from '@/lib/fechas';
import { rangoDeFechas } from '@/lib/rango';
import { type ServicioClientes, nombreCompleto } from '@/modules/clientes';
import { type Metodo, prepararAnulacion, totalesDeCaja } from '../domain/pago';
import type { RepoPagos } from '../infrastructure/pagos.repo';

type FilaConDetalle = ReturnType<RepoPagos['enRango']>[number];

function aVista(fila: FilaConDetalle) {
  const { clienteNombre, clienteApellido, ...resto } = fila;
  return {
    ...resto,
    clienteNombreCompleto: nombreCompleto({
      nombre: clienteNombre,
      apellido: clienteApellido,
    }),
  };
}

export function crearServicioPagos(
  repo: RepoPagos,
  clientes: Pick<ServicioClientes, 'obtener'>,
) {
  return {
    /**
     * Los pagos de un rango (por defecto, hoy) y cuánto entró por cada método.
     * Los totales son de todo el rango filtrado; los anulados se listan pero
     * no suman.
     */
    listar(
      filtro: { desde?: string | null; hasta?: string | null; metodo?: Metodo },
      hoy: FechaISO,
    ) {
      const rango = rangoDeFechas(filtro, hoy);
      const filas = repo.enRango({ ...rango, metodo: filtro.metodo });

      return {
        ...rango,
        hoy,
        pagos: filas.map(aVista),
        totales: totalesDeCaja(filas),
      };
    },

    deCliente(clienteId: number) {
      clientes.obtener(clienteId); // 404 si no existe
      return { pagos: repo.deCliente(clienteId).map(aVista) };
    },

    /** Anula un pago con motivo. Cancela también la membresía que pagaba. */
    anular(id: number, motivo: string) {
      const pago = repo.porId(id);
      if (!pago) throw new NoEncontradoError('el pago', id);

      const anulado = repo.anular(id, prepararAnulacion(pago, motivo));

      return {
        id: anulado.id,
        anulado: anulado.anulado,
        motivoAnulacion: anulado.motivoAnulacion,
        membresiaCancelada: anulado.membresiaId !== null,
      };
    },
  };
}

export type ServicioPagos = ReturnType<typeof crearServicioPagos>;
export type ListaDePagos = ReturnType<ServicioPagos['listar']>;
export type PagosDeCliente = ReturnType<ServicioPagos['deCliente']>;
export type PagoVista = ListaDePagos['pagos'][number];
