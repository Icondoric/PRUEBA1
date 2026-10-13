/**
 * CAPA APPLICATION — administrar planes, precios y promociones.
 *
 * La venta NO pasa por acá (eso es el módulo membresias). Esto es lo que usa
 * quien tiene el acceso "Planes y precios" para decidir qué se vende y a
 * cuánto.
 */

import { NoEncontradoError, ReglaDeNegocioError } from '@/lib/errors';
import type { FechaISO } from '@/lib/fechas';
import {
  type PrecioResuelto,
  SinPrecioVigenteError,
  resolverPrecio,
} from '@/modules/membresias';
import {
  type DatosPlan,
  type DatosPrecio,
  estadoDePrecio,
  prepararPlan,
  prepararPrecio,
  sePuedeQuitar,
  validarNombreDePlan,
} from '../domain/plan';
import type { PrecioFila, RepoPlanes } from '../infrastructure/planes.repo';

type PrecioSimple = Pick<
  PrecioFila,
  | 'id'
  | 'planId'
  | 'precioCentavos'
  | 'vigenteDesde'
  | 'vigenteHasta'
  | 'esPromocion'
  | 'etiqueta'
>;

/** El precio que se cobraría ese día, o null si el plan no tiene ninguno. */
function precioEl(
  precios: PrecioSimple[],
  fecha: FechaISO,
  planId: number,
): PrecioResuelto | null {
  try {
    return resolverPrecio(precios, fecha, planId);
  } catch (error) {
    if (error instanceof SinPrecioVigenteError) return null;
    throw error;
  }
}

export function crearServicioPlanes(repo: RepoPlanes) {
  function buscarPlan(id: number) {
    const plan = repo.planPorId(id);
    if (!plan) throw new NoEncontradoError('el plan', id);
    return plan;
  }

  return {
    /** Todos los planes con su precio de hoy y el historial de precios. */
    listar(hoy: FechaISO) {
      const precios = repo.precios();
      const usados = repo.preciosUsados();

      const planes = repo.planes().map((plan) => ({
        id: plan.id,
        nombre: plan.nombre,
        diasDuracion: plan.diasDuracion,
        esPaseDiario: plan.esPaseDiario,
        activo: plan.activo,
        precioHoy: precioEl(precios, hoy, plan.id),
        precios: precios
          .filter((p) => p.planId === plan.id)
          .map((p) => ({
            id: p.id,
            precioCentavos: p.precioCentavos,
            vigenteDesde: p.vigenteDesde,
            vigenteHasta: p.vigenteHasta,
            esPromocion: p.esPromocion,
            etiqueta: p.etiqueta,
            estado: estadoDePrecio(p, hoy),
            sePuedeQuitar: sePuedeQuitar(p, hoy, usados.has(p.id)),
          })),
      }));

      return { hoy, planes };
    },

    /** Un plan nace con su precio: sin precio no se puede vender. */
    crearPlan(entrada: DatosPlan & { precioCentavos: number }, hoy: FechaISO) {
      const plan = prepararPlan(entrada);
      const precio = prepararPrecio(
        { precioCentavos: entrada.precioCentavos, vigenteDesde: hoy, esPromocion: false },
        hoy,
      );
      return repo.insertarPlanConPrecio(plan, precio);
    },

    /** Solo el nombre. La duración no se toca: se crea otro plan. */
    renombrarPlan(id: number, nombre: string) {
      buscarPlan(id);
      return repo.actualizarPlan(id, { nombre: validarNombreDePlan(nombre) });
    },

    /**
     * Dar de baja un plan (o volver a ofrecerlo). No se borra: las membresías
     * ya vendidas lo siguen mostrando.
     */
    cambiarEstadoDePlan(id: number, activo: boolean) {
      buscarPlan(id);
      return repo.actualizarPlan(id, { activo });
    },

    /**
     * Qué se cobraría con ese precio cargado: hoy, y el día que empieza a
     * regir. Para mostrarlo ANTES de guardar. No guarda nada.
     */
    simularPrecio(planId: number, entrada: DatosPrecio, hoy: FechaISO) {
      buscarPlan(planId);
      const nuevo = prepararPrecio(entrada, hoy);
      const conElNuevo: PrecioSimple[] = [
        ...repo.preciosDePlan(planId),
        { ...nuevo, id: 0, planId },
      ];

      return {
        hoy: precioEl(conElNuevo, hoy, planId),
        desde: nuevo.vigenteDesde,
        elDiaQueEmpieza: precioEl(conElNuevo, nuevo.vigenteDesde, planId),
      };
    },

    /** Agrega un precio o una promoción. Nunca modifica uno existente. */
    agregarPrecio(planId: number, entrada: DatosPrecio, hoy: FechaISO) {
      buscarPlan(planId);
      return repo.insertarPrecio({ ...prepararPrecio(entrada, hoy), planId });
    },

    quitarPrecio(id: number, hoy: FechaISO): void {
      const precio = repo.precioPorId(id);
      if (!precio) throw new NoEncontradoError('el precio', id);

      if (!sePuedeQuitar(precio, hoy, repo.preciosUsados().has(id))) {
        throw new ReglaDeNegocioError(
          'Ese precio ya empezó a regir o ya se vendió con él: no se puede quitar. ' +
            'Para corregirlo, cargá otro precio encima.',
        );
      }
      repo.quitarPrecio(id);
    },
  };
}

export type ServicioPlanes = ReturnType<typeof crearServicioPlanes>;
export type ListaDePlanes = ReturnType<ServicioPlanes['listar']>;
export type PlanAdministrable = ListaDePlanes['planes'][number];
export type SimulacionDePrecio = ReturnType<ServicioPlanes['simularPrecio']>;
