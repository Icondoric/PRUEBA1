/**
 * Resolución del precio vigente de un plan en una fecha dada.
 *
 * Así se modelan las promociones de temporada del gimnasio: en vez de editar
 * el precio del plan (que borraría el historial y rompería los reportes
 * pasados), se agrega una fila de precio con vigencia acotada.
 *
 * Reglas:
 *   - Gana la vigencia más específica: una promo con fecha de fin le gana al
 *     precio base abierto.
 *   - Si dos promos se solapan, gana la que empezó después (la más reciente
 *     es la intención más fresca del dueño).
 *   - Si no hay ningún precio vigente, es un error de configuración, no un
 *     precio cero.
 *
 * Función PURA: recibe las filas y la fecha, no toca la base.
 */

import { type FechaISO, esPosteriorOIgual } from '@/lib/fechas';

export interface PrecioVigencia {
  id: number;
  planId: number;
  precioCentavos: number;
  vigenteDesde: FechaISO;
  /** null = abierto, es el precio base. */
  vigenteHasta: FechaISO | null;
  esPromocion: boolean;
  etiqueta: string | null;
}

export interface PrecioResuelto {
  precioCentavos: number;
  planPrecioId: number;
  esPromocion: boolean;
  etiqueta: string | null;
  /** Cuánto se ahorra respecto del precio base, en centavos. 0 si no hay promo. */
  descuentoCentavos: number;
}

export class SinPrecioVigenteError extends Error {
  constructor(planId: number, fecha: FechaISO) {
    super(`El plan ${planId} no tiene precio vigente al ${fecha}`);
    this.name = 'SinPrecioVigenteError';
  }
}

function estaVigente(p: PrecioVigencia, fecha: FechaISO): boolean {
  if (!esPosteriorOIgual(fecha, p.vigenteDesde)) return false;
  if (p.vigenteHasta === null) return true;
  return esPosteriorOIgual(p.vigenteHasta, fecha); // el último día incluido
}

export function precioBase(
  precios: PrecioVigencia[],
  fecha: FechaISO,
): PrecioVigencia | null {
  const abiertos = precios
    .filter((p) => !p.esPromocion && estaVigente(p, fecha))
    .sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? 1 : -1));
  return abiertos[0] ?? null;
}

export function resolverPrecio(
  precios: PrecioVigencia[],
  fecha: FechaISO,
  planId: number,
): PrecioResuelto {
  const vigentes = precios.filter((p) => p.planId === planId && estaVigente(p, fecha));

  if (vigentes.length === 0) throw new SinPrecioVigenteError(planId, fecha);

  // Promoción le gana al precio base; entre varias, la que empezó después.
  const elegido = vigentes.sort((a, b) => {
    if (a.esPromocion !== b.esPromocion) return a.esPromocion ? -1 : 1;
    return a.vigenteDesde < b.vigenteDesde ? 1 : -1;
  })[0]!;

  const base = precioBase(
    precios.filter((p) => p.planId === planId),
    fecha,
  );

  const descuento =
    base && elegido.esPromocion
      ? Math.max(0, base.precioCentavos - elegido.precioCentavos)
      : 0;

  return {
    precioCentavos: elegido.precioCentavos,
    planPrecioId: elegido.id,
    esPromocion: elegido.esPromocion,
    etiqueta: elegido.etiqueta,
    descuentoCentavos: descuento,
  };
}
