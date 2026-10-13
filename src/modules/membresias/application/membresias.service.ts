/**
 * CAPA APPLICATION — casos de uso de membresías: qué se vende, cuánto saldría,
 * vender, y el historial de un cliente.
 *
 * Orquesta: pide los datos al repositorio y deja que el dominio decida. Sin
 * SQL y sin HTTP. `hoy` y el usuario que opera entran por parámetro.
 */

import { NoEncontradoError, ReglaDeNegocioError } from '@/lib/errors';
import type { FechaISO } from '@/lib/fechas';
import type { ServicioClientes } from '@/modules/clientes';
import {
  type Cobertura,
  coberturaDelCliente,
  estaPorVencer,
  estadoMembresia,
} from '../domain/estado';
import { SinPrecioVigenteError, resolverPrecio } from '../domain/precios';
import { cotizarVenta } from '../domain/venta';
import type { PagoFila, RepoMembresias } from '../infrastructure/membresias.repo';

export interface EntradaCotizar {
  clienteId: number;
  planId: number;
  inicio?: string | null;
}

export interface EntradaVender extends EntradaCotizar {
  metodo: PagoFila['metodo'];
  nota?: string | null;
}

export function crearServicioMembresias(
  repo: RepoMembresias,
  clientes: Pick<ServicioClientes, 'obtener'>,
  /** Con cuántos días de anticipación se avisa: el mismo aviso del check-in. */
  opciones: { diasDeAviso?: number } = {},
) {
  const diasDeAviso = opciones.diasDeAviso ?? 3;

  /** La situación, con el dato de si conviene avisarle que renueve. */
  const conAviso = (cobertura: Cobertura) => ({
    ...cobertura,
    porVencer: estaPorVencer(cobertura, diasDeAviso),
  });

  function preparar(entrada: EntradaCotizar, hoy: FechaISO) {
    const cliente = clientes.obtener(entrada.clienteId);
    if (!cliente.activo) {
      throw new ReglaDeNegocioError(
        `${cliente.nombreCompleto} está dado de baja: no se le puede vender una membresía`,
        { clienteId: cliente.id },
      );
    }

    const plan = repo.planPorId(entrada.planId);
    if (!plan) throw new NoEncontradoError('el plan', entrada.planId);

    const anterior = repo.ultimaNoCancelada(cliente.id) ?? null;

    const { periodo, precio } = cotizarVenta({
      hoy,
      plan,
      precios: repo.preciosDePlan(plan.id),
      fechaFinAnterior: anterior?.fechaFin ?? null,
      inicioForzado: entrada.inicio,
    });

    return { cliente, plan, anterior, periodo, precio };
  }

  return {
    /** Lo que se puede vender hoy, con el precio que corresponde hoy. */
    planesConPrecio(hoy: FechaISO) {
      const precios = repo.precios();

      const planes = repo.planesActivos().map((plan) => {
        const base = {
          id: plan.id,
          nombre: plan.nombre,
          diasDuracion: plan.diasDuracion,
          esPaseDiario: plan.esPaseDiario,
        };
        try {
          return { ...base, precio: resolverPrecio(precios, hoy, plan.id) };
        } catch (error) {
          // Un plan sin precio vigente está mal configurado. Se lista igual,
          // marcado, para que la pantalla lo muestre deshabilitado en vez de
          // esconderlo y que nadie sepa por qué falta.
          if (error instanceof SinPrecioVigenteError) return { ...base, precio: null };
          throw error;
        }
      });

      return { hoy, planes };
    },

    /** Qué pasaría si se vendiera. No guarda nada. */
    cotizar(entrada: EntradaCotizar, hoy: FechaISO) {
      const { plan, anterior, periodo, precio } = preparar(entrada, hoy);

      return {
        plan: { id: plan.id, nombre: plan.nombre, esPaseDiario: plan.esPaseDiario },
        fechaInicio: periodo.fechaInicio,
        fechaFin: periodo.fechaFin,
        diasDuracion: plan.diasDuracion,
        encadenada: periodo.encadenada,
        diasArrastrados: periodo.diasArrastrados,
        /** fecha_fin de la membresía anterior, para explicar el período. */
        fechaFinAnterior: anterior?.fechaFin ?? null,
        precioCentavos: precio.precioCentavos,
        esPromocion: precio.esPromocion,
        etiqueta: precio.etiqueta,
        descuentoCentavos: precio.descuentoCentavos,
      };
    },

    /**
     * Vende: crea una membresía NUEVA y su pago. Recalcula período y precio
     * acá; lo que haya mostrado la pantalla es solo una vista previa.
     */
    vender(entrada: EntradaVender, hoy: FechaISO, usuarioId: number) {
      const { cliente, plan, periodo, precio } = preparar(entrada, hoy);

      const { membresia, pago } = repo.registrarVenta({
        clienteId: cliente.id,
        planId: plan.id,
        fechaInicio: periodo.fechaInicio,
        fechaFin: periodo.fechaFin,
        precioCentavos: precio.precioCentavos,
        planPrecioId: precio.planPrecioId,
        fechaPago: hoy,
        metodo: entrada.metodo,
        nota: entrada.nota?.trim() || null,
        usuarioId,
      });

      return {
        membresia: { ...membresia, planNombre: plan.nombre },
        pago: { id: pago.id, montoCentavos: pago.montoCentavos, metodo: pago.metodo },
      };
    },

    /**
     * En qué situación está cada uno de estos clientes. Para la lista: una
     * sola consulta para toda la página, en vez de abrir ficha por ficha.
     */
    coberturas(clienteIds: number[], hoy: FechaISO) {
      const filas = repo.paraCoberturas(clienteIds);
      return {
        hoy,
        coberturas: clienteIds.map((clienteId) => ({
          clienteId,
          ...conAviso(
            coberturaDelCliente(
              filas.filter((fila) => fila.clienteId === clienteId),
              hoy,
            ),
          ),
        })),
      };
    },

    /** Historial del cliente y en qué situación está hoy. */
    historial(clienteId: number, hoy: FechaISO) {
      clientes.obtener(clienteId); // 404 si no existe

      const filas = repo.deCliente(clienteId);

      return {
        cobertura: conAviso(coberturaDelCliente(filas, hoy)),
        membresias: filas.map((fila) => ({
          ...fila,
          estado: estadoMembresia(fila, hoy),
        })),
      };
    },
  };
}

export type ServicioMembresias = ReturnType<typeof crearServicioMembresias>;
export type PlanesConPrecio = ReturnType<ServicioMembresias['planesConPrecio']>;
export type CotizacionVista = ReturnType<ServicioMembresias['cotizar']>;
export type VentaRegistrada = ReturnType<ServicioMembresias['vender']>;
export type HistorialMembresias = ReturnType<ServicioMembresias['historial']>;
export type CoberturasDeClientes = ReturnType<ServicioMembresias['coberturas']>;
