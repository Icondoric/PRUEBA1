/**
 * CAPA DOMAIN — ingresos, asistencia y pases, agrupados para leer.
 */

import { type FechaISO, esAnterior } from '@/lib/fechas';
import { type MesISO, diaDeSemana, diasDelRango, mesDe } from './calendario';

/** Un pase suelto no es un patrón; desde el cuarto, conviene ofrecerle un plan. */
export const PASES_PARA_SER_FRECUENTE = 3;

export interface ConteoDeIngresos {
  fecha: FechaISO;
  /** 'permitido' y 'por_vencer' entran; 'vencido' y 'sin_membresia' rebotan. */
  resultado: 'permitido' | 'por_vencer' | 'vencido' | 'sin_membresia';
  cantidad: number;
}

const entro = (r: ConteoDeIngresos['resultado']) =>
  r === 'permitido' || r === 'por_vencer';

/** Un renglón por día del rango, también los días sin nadie. */
export function ingresosPorDia(
  conteos: ReadonlyArray<ConteoDeIngresos>,
  desde: FechaISO,
  hasta: FechaISO,
): Array<{ fecha: FechaISO; permitidos: number; rechazados: number }> {
  return diasDelRango(desde, hasta).map((fecha) => {
    const delDia = conteos.filter((c) => c.fecha === fecha);
    const suma = (cuales: ConteoDeIngresos[]) =>
      cuales.reduce((total, c) => total + c.cantidad, 0);
    return {
      fecha,
      permitidos: suma(delDia.filter((c) => entro(c.resultado))),
      rechazados: suma(delDia.filter((c) => !entro(c.resultado))),
    };
  });
}

/**
 * Cuánta gente entra cada día de la semana, en promedio.
 *
 * Devuelve el total y cuántas veces cayó ese día en el rango; el promedio lo
 * redondea quien lo muestra. Así no hay decimales dando vueltas por el sistema.
 */
export function asistenciaPorDiaDeSemana(
  conteos: ReadonlyArray<ConteoDeIngresos>,
  desde: FechaISO,
  hasta: FechaISO,
): Array<{ dia: number; ingresos: number; ocurrencias: number }> {
  const porDia = ingresosPorDia(conteos, desde, hasta);

  return [0, 1, 2, 3, 4, 5, 6].map((dia) => {
    const suyos = porDia.filter((d) => diaDeSemana(d.fecha) === dia);
    return {
      dia,
      ingresos: suyos.reduce((total, d) => total + d.permitidos, 0),
      ocurrencias: suyos.length,
    };
  });
}

export interface PaseVendido {
  clienteId: number;
  nroSocio: number;
  nombreCompleto: string;
  telefono: string | null;
  fecha: FechaISO;
}

export function pasesPorMes(
  pases: ReadonlyArray<Pick<PaseVendido, 'fecha'>>,
  meses: MesISO[],
): Array<{ mes: MesISO; cantidad: number }> {
  return meses.map((mes) => ({
    mes,
    cantidad: pases.filter((p) => mesDe(p.fecha) === mes).length,
  }));
}

/**
 * Quiénes vinieron con pase MÁS de 3 veces desde `desde`. Son los candidatos a
 * ofrecerles un plan, salvo los que ya son socios activos.
 */
export function clientesFrecuentesConPase(
  pases: ReadonlyArray<PaseVendido>,
  desde: FechaISO,
  sociosActivos: ReadonlySet<number>,
) {
  const porCliente = new Map<
    number,
    { datos: PaseVendido; cantidad: number; ultimo: FechaISO }
  >();

  for (const pase of pases) {
    if (esAnterior(pase.fecha, desde)) continue;
    const previo = porCliente.get(pase.clienteId);
    porCliente.set(pase.clienteId, {
      datos: pase,
      cantidad: (previo?.cantidad ?? 0) + 1,
      ultimo:
        previo && esAnterior(pase.fecha, previo.ultimo) ? previo.ultimo : pase.fecha,
    });
  }

  return [...porCliente.values()]
    .filter((c) => c.cantidad > PASES_PARA_SER_FRECUENTE)
    .map((c) => ({
      clienteId: c.datos.clienteId,
      nroSocio: c.datos.nroSocio,
      nombreCompleto: c.datos.nombreCompleto,
      telefono: c.datos.telefono,
      cantidad: c.cantidad,
      ultimoPase: c.ultimo,
      yaEsSocio: sociosActivos.has(c.datos.clienteId),
    }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nroSocio - b.nroSocio);
}
