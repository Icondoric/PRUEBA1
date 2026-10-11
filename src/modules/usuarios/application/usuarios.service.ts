/**
 * CAPA APPLICATION — usuarios del sistema.
 *
 * PROVISORIO HASTA QUE EXISTA EL LOGIN. Hoy no hay sesión, pero toda membresía
 * y todo pago tienen que guardar quién los registró. `operadorActual()` es el
 * único punto que responde "¿quién está operando?": por ahora siempre la
 * cuenta `recepcion`, que se crea sola si la base no la tiene.
 *
 * Cuando llegue el módulo de auth, esto se reemplaza por el usuario de la
 * sesión y nada más cambia: los servicios ya reciben el id por parámetro.
 */

import { randomBytes, scryptSync } from 'node:crypto';
import type { RepoUsuarios, UsuarioFila } from '../infrastructure/usuarios.repo';

const USUARIO_RECEPCION = 'recepcion';

/** Un hash que no corresponde a ninguna contraseña conocida: nadie entra con él. */
function hashInutilizable(): string {
  const sal = randomBytes(16);
  const hash = scryptSync(randomBytes(24), sal, 64);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export function crearServicioUsuarios(repo: RepoUsuarios) {
  return {
    operadorActual(): UsuarioFila {
      return (
        repo.porUsuario(USUARIO_RECEPCION) ??
        repo.insertar({
          usuario: USUARIO_RECEPCION,
          nombre: 'Recepción',
          passwordHash: hashInutilizable(),
          rol: 'recepcion',
        })
      );
    },
  };
}

export type ServicioUsuarios = ReturnType<typeof crearServicioUsuarios>;
