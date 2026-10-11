/**
 * CAPA APPLICATION — el caso de uso del check-in.
 *
 * Busca a quien tecleó su número, le pregunta al dominio si entra y deja el
 * ingreso registrado. SIEMPRE lo registra, permitido o rechazado: los rebotes
 * son tan importantes como las entradas para saber a quién llamar.
 */

import type { FechaISO } from '@/lib/fechas';
import type { ServicioClientes } from '@/modules/clientes';
import { evaluarAcceso } from '../domain/acceso';
import { vigenciaParaAcceso } from '../domain/vigencia';
import type { RepoCheckin } from '../infrastructure/checkin.repo';

export function crearServicioCheckin(
  repo: RepoCheckin,
  clientes: Pick<ServicioClientes, 'buscarPorIdentificador'>,
) {
  return {
    registrar(identificador: string, hoy: FechaISO) {
      const cliente = clientes.buscarPorIdentificador(identificador);

      // Un número que no es de nadie no se puede guardar como ingreso (el
      // ingreso es de un cliente). Se informa y listo.
      if (!cliente)
        return { encontrado: false as const, identificador: identificador.trim() };

      const vigencia = vigenciaParaAcceso(repo.membresiasDe(cliente.id), hoy);

      const veredicto = evaluarAcceso(
        {
          clienteId: cliente.id,
          nroSocio: cliente.nroSocio,
          nombreCompleto: cliente.nombreCompleto,
          fotoUrl: cliente.fotoUrl,
          fechaFin: vigencia.fechaFin,
          membresiaId: vigencia.membresiaId,
          esPaseDiario: vigencia.esPaseDiario,
          bloqueado: cliente.bloqueado,
        },
        hoy,
      );

      const ingreso = repo.registrarIngreso({
        clienteId: cliente.id,
        membresiaId: vigencia.membresiaId,
        fecha: hoy,
        resultado: veredicto.resultado,
      });

      return {
        encontrado: true as const,
        ingresoId: ingreso.id,
        resultado: veredicto.resultado,
        permitir: veredicto.permitir,
        diasRestantes: veredicto.diasRestantes,
        mensaje: veredicto.mensaje,
        socio: {
          clienteId: cliente.id,
          nroSocio: cliente.nroSocio,
          nombreCompleto: cliente.nombreCompleto,
          fotoUrl: cliente.fotoUrl,
        },
        /** Tiene una membresía paga que todavía no empezó. */
        proximaDesde: veredicto.permitir ? null : vigencia.proximaDesde,
      };
    },
  };
}

export type ServicioCheckin = ReturnType<typeof crearServicioCheckin>;
export type ResultadoCheckin = ReturnType<ServicioCheckin['registrar']>;
