/**
 * CAPA APPLICATION — los casos de uso del mostrador.
 *
 *   registrar   alguien teclea su número: ¿entra? Queda el ingreso anotado.
 *   venderPase  alguien paga la sesión de hoy: cliente (si es nuevo) +
 *               membresía de un día + pago + ingreso, en un solo paso.
 *
 * El ingreso se registra SIEMPRE, permitido o rechazado: los rebotes son tan
 * importantes como las entradas para saber a quién llamar.
 */

import { ReglaDeNegocioError } from '@/lib/errors';
import { type FechaISO, diasEntre, sumarDias } from '@/lib/fechas';
import type { ClienteVista, ServicioClientes } from '@/modules/clientes';
import type { ServicioMembresias } from '@/modules/membresias';
import { evaluarAcceso } from '../domain/acceso';
import { vigenciaParaAcceso } from '../domain/vigencia';
import type { RepoCheckin } from '../infrastructure/checkin.repo';

/** La ventana de "viene seguido": el último mes. */
const DIAS_DE_ASISTENCIA = 30;

export interface EntradaPase {
  /** Si ya es cliente. Si no viene, se crea uno con `nombre`. */
  clienteId?: number | null;
  nombre?: string | null;
  metodo: Parameters<ServicioMembresias['vender']>[0]['metodo'];
}

export function crearServicioCheckin(
  repo: RepoCheckin,
  deps: {
    clientes: Pick<ServicioClientes, 'buscarPorIdentificador' | 'obtener' | 'registrar'>;
    membresias: Pick<ServicioMembresias, 'planesConPrecio' | 'vender'>;
  },
) {
  const { clientes, membresias } = deps;

  function veredictoDe(cliente: ClienteVista, hoy: FechaISO) {
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
    return { vigencia, veredicto };
  }

  function ingresar(cliente: ClienteVista, hoy: FechaISO) {
    const { vigencia, veredicto } = veredictoDe(cliente, hoy);

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
      /** No entra porque está bloqueado: un pase no lo arregla. */
      bloqueado: cliente.bloqueado,
      /** Tiene una membresía paga que todavía no empezó. */
      proximaDesde: veredicto.permitir ? null : vigencia.proximaDesde,
    };
  }

  /** El pase que se vende en el mostrador: el primero activo y con precio. */
  function pasePorSesion(hoy: FechaISO) {
    const plan = membresias
      .planesConPrecio(hoy)
      .planes.find((p) => p.esPaseDiario && p.precio !== null);

    if (!plan || !plan.precio) return null;
    return { id: plan.id, nombre: plan.nombre, precio: plan.precio };
  }

  return {
    registrar(identificador: string, hoy: FechaISO) {
      const cliente = clientes.buscarPorIdentificador(identificador);

      // Un número que no es de nadie no se puede guardar como ingreso (el
      // ingreso es de un cliente). Se informa y listo.
      if (!cliente) {
        return { encontrado: false as const, identificador: identificador.trim() };
      }

      return ingresar(cliente, hoy);
    },

    /** Cuándo vino por última vez y cuánto viene. Para la ficha del cliente. */
    asistencia(clienteId: number, hoy: FechaISO) {
      clientes.obtener(clienteId); // 404 si no existe
      const { ultimo, dias } = repo.asistenciaDe(
        clienteId,
        sumarDias(hoy, -(DIAS_DE_ASISTENCIA - 1)),
      );
      return {
        ultimoIngreso: ultimo,
        /** Hace cuántos días fue. 0 = hoy. null si nunca entró. */
        haceDias: ultimo === null ? null : diasEntre(ultimo, hoy),
        diasQueVino: dias,
        enDias: DIAS_DE_ASISTENCIA,
      };
    },

    /** Qué pase se vende hoy y a cuánto. null si no hay ninguno configurado. */
    pasePorSesion,

    venderPase(entrada: EntradaPase, hoy: FechaISO, usuarioId: number) {
      const pase = pasePorSesion(hoy);
      if (!pase) {
        throw new ReglaDeNegocioError(
          'No hay un pase por sesión con precio cargado. Avisale al administrador.',
        );
      }

      // Todo lo que puede rechazar la venta se revisa ANTES de crear o cobrar.
      const existente = entrada.clienteId ? clientes.obtener(entrada.clienteId) : null;

      if (existente) {
        if (existente.bloqueado) {
          throw new ReglaDeNegocioError(
            `${existente.nombreCompleto} tiene el acceso bloqueado: no se le puede vender un pase`,
            { clienteId: existente.id },
          );
        }
        if (existente.activo && veredictoDe(existente, hoy).veredicto.permitir) {
          throw new ReglaDeNegocioError(
            `${existente.nombreCompleto} ya puede entrar hoy: no necesita un pase`,
            { clienteId: existente.id },
          );
        }
      }

      // Cliente ligero: para pagar una sesión alcanza con el nombre.
      const cliente =
        existente ?? clientes.registrar({ nombre: entrada.nombre ?? '' }, hoy);

      membresias.vender(
        { clienteId: cliente.id, planId: pase.id, metodo: entrada.metodo },
        hoy,
        usuarioId,
      );

      return {
        ...ingresar(clientes.obtener(cliente.id), hoy),
        esClienteNuevo: !existente,
      };
    },
  };
}

export type ServicioCheckin = ReturnType<typeof crearServicioCheckin>;
export type ResultadoCheckin = ReturnType<ServicioCheckin['registrar']>;
export type PaseVendido = ReturnType<ServicioCheckin['venderPase']>;
export type PaseEnVenta = ReturnType<ServicioCheckin['pasePorSesion']>;
export type AsistenciaDeCliente = ReturnType<ServicioCheckin['asistencia']>;
