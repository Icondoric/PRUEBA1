import { describe, expect, it } from 'vitest';
import { ReglaDeNegocioError } from '@/lib/errors';
import {
  INTENTOS_ANTES_DE_BLOQUEAR,
  SEGUNDOS_DE_BLOQUEO,
  segundosDeEspera,
  sesionVigente,
  validarPassword,
  validarUsuario,
} from './credenciales';
import {
  CATALOGO_DE_ACCESOS,
  PERMISOS_BASICOS,
  TODOS_LOS_PERMISOS,
  permisosEfectivos,
  puede,
  puedeAlguno,
} from './permisos';

const hora = (h: number, m = 0) => new Date(Date.UTC(2026, 2, 10, h, m));

describe('catálogo de accesos', () => {
  it('no repite ninguna clave', () => {
    expect(new Set(TODOS_LOS_PERMISOS).size).toBe(TODOS_LOS_PERMISOS.length);
  });

  it('cada clave empieza con el nombre de su módulo: se lee sola', () => {
    for (const modulo of CATALOGO_DE_ACCESOS) {
      const prefijos = new Set(modulo.accesos.map((a) => a.clave.split('.')[0]));
      expect(prefijos.size).toBe(1);
    }
  });

  it('lo básico de recepción no incluye nada delicado', () => {
    expect(PERMISOS_BASICOS).not.toContain('pagos.anular');
    expect(PERMISOS_BASICOS).not.toContain('pagos.otras_fechas');
    expect(PERMISOS_BASICOS).not.toContain('reportes.ver');
    expect(PERMISOS_BASICOS).not.toContain('planes.gestionar');
    expect(PERMISOS_BASICOS).not.toContain('clientes.bloquear');
    expect(PERMISOS_BASICOS).not.toContain('clientes.baja');
  });

  it('lo básico alcanza para atender el mostrador', () => {
    expect(PERMISOS_BASICOS).toEqual(
      expect.arrayContaining([
        'clientes.gestionar',
        'membresias.vender',
        'checkin.usar',
        'checkin.pases',
        'pagos.caja_hoy',
        'visitas.gestionar',
      ]),
    );
  });
});

describe('puede', () => {
  it('el dueño puede todo, aunque no tenga nada marcado', () => {
    const dueno = { rol: 'admin' as const, permisos: [] };
    expect(TODOS_LOS_PERMISOS.every((p) => puede(dueno, p))).toBe(true);
  });

  it('recepción puede solo lo que le dieron', () => {
    const ana = { rol: 'recepcion' as const, permisos: ['clientes.gestionar' as const] };
    expect(puede(ana, 'clientes.gestionar')).toBe(true);
    expect(puede(ana, 'reportes.ver')).toBe(false);
  });

  it('con tener uno de varios alcanza', () => {
    const ana = { rol: 'recepcion' as const, permisos: ['checkin.pases' as const] };
    expect(puedeAlguno(ana, ['clientes.gestionar', 'checkin.pases'])).toBe(true);
    expect(puedeAlguno(ana, ['reportes.ver', 'pagos.anular'])).toBe(false);
  });

  it('un acceso guardado que ya no existe en el catálogo se ignora', () => {
    expect(
      permisosEfectivos('recepcion', ['clientes.gestionar', 'modulo.viejo']),
    ).toEqual(['clientes.gestionar']);
  });

  it('los accesos efectivos del dueño son todos', () => {
    expect(permisosEfectivos('admin', [])).toEqual(TODOS_LOS_PERMISOS);
  });
});

describe('usuario y contraseña', () => {
  it('el usuario se guarda en minúsculas y sin espacios alrededor', () => {
    expect(validarUsuario('  Ana.Quispe ')).toBe('ana.quispe');
  });

  it('rechaza usuarios con espacios, muy cortos o con símbolos raros', () => {
    expect(() => validarUsuario('ana quispe')).toThrow(ReglaDeNegocioError);
    expect(() => validarUsuario('an')).toThrow(ReglaDeNegocioError);
    expect(() => validarUsuario('ana@gym')).toThrow(ReglaDeNegocioError);
  });

  it('la contraseña necesita al menos 8 caracteres', () => {
    expect(() => validarPassword('1234567')).toThrow(ReglaDeNegocioError);
    expect(validarPassword('caja-9-x')).toBe('caja-9-x');
  });

  it('rechaza las que probaría cualquiera primero', () => {
    expect(() => validarPassword('12345678')).toThrow(ReglaDeNegocioError);
    expect(() => validarPassword('Password123')).toThrow(ReglaDeNegocioError);
    expect(() => validarPassword('aaaaaaaaaa')).toThrow(ReglaDeNegocioError);
    expect(validarPassword('pesas-y-mancuernas')).toBe('pesas-y-mancuernas');
  });
});

describe('sesión', () => {
  it('sigue vigente justo a las 8 horas de inactividad', () => {
    expect(sesionVigente(hora(8), hora(16), 8)).toBe(true);
  });

  it('vence pasadas las 8 horas', () => {
    expect(sesionVigente(hora(8), hora(16, 1), 8)).toBe(false);
  });
});

describe('intentos fallidos', () => {
  it('con menos de 5, puede seguir probando', () => {
    expect(segundosDeEspera({ cantidad: 4, ultimo: hora(10) }, hora(10))).toBe(0);
    expect(segundosDeEspera(undefined, hora(10))).toBe(0);
  });

  it('al quinto, espera un minuto contado desde el último', () => {
    const intentos = { cantidad: INTENTOS_ANTES_DE_BLOQUEAR, ultimo: hora(10) };
    expect(segundosDeEspera(intentos, hora(10))).toBe(SEGUNDOS_DE_BLOQUEO);
    expect(segundosDeEspera(intentos, new Date(hora(10).getTime() + 45_000))).toBe(15);
  });

  it('pasado el minuto, puede volver a intentar', () => {
    const intentos = { cantidad: 9, ultimo: hora(10) };
    expect(segundosDeEspera(intentos, hora(10, 1))).toBe(0);
  });
});
