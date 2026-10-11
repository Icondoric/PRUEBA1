import { describe, expect, it } from 'vitest';
import { ReglaDeNegocioError } from '@/lib/errors';
import {
  nombreCompleto,
  normalizarIdentificador,
  prepararAlta,
  siguienteNroSocio,
  tipoCliente,
} from './cliente';

describe('normalizarIdentificador', () => {
  it('un CI con puntos y uno sin puntos son la misma persona', () => {
    expect(normalizarIdentificador('1.234.567')).toBe('1234567');
    expect(normalizarIdentificador(' 1234567 ')).toBe('1234567');
    expect(normalizarIdentificador('1-234-567')).toBe('1234567');
  });
});

describe('prepararAlta', () => {
  it('acepta un cliente con solo el nombre (venta de pase por sesión)', () => {
    const c = prepararAlta({ nombre: 'Marcelo' });
    expect(c.nombre).toBe('Marcelo');
    expect(c.apellido).toBeNull();
    expect(c.ci).toBeNull();
    expect(c.ciExtension).toBeNull();
  });

  it('normaliza el CI y le pone extensión por defecto', () => {
    const c = prepararAlta({ nombre: 'Ana', apellido: 'Quispe', ci: '1.234.567' });
    expect(c.ci).toBe('1234567');
    expect(c.ciExtension).toBe('LP');
  });

  it('no guarda extensión si no hay CI', () => {
    expect(prepararAlta({ nombre: 'Ana', ciExtension: 'CB' }).ciExtension).toBeNull();
  });

  it('rechaza un nombre vacío', () => {
    expect(() => prepararAlta({ nombre: '  ' })).toThrow(ReglaDeNegocioError);
  });

  it('rechaza un CI que no son dígitos', () => {
    expect(() => prepararAlta({ nombre: 'Ana', ci: 'abc123' })).toThrow(
      ReglaDeNegocioError,
    );
  });

  it('rechaza una extensión inventada', () => {
    expect(() => prepararAlta({ nombre: 'Ana', ci: '123456', ciExtension: 'XX' })).toThrow(
      ReglaDeNegocioError,
    );
  });

  it('convierte strings vacíos en null, no en ""', () => {
    const c = prepararAlta({ nombre: 'Ana', apellido: '', telefono: '  ' });
    expect(c.apellido).toBeNull();
    expect(c.telefono).toBeNull();
  });
});

describe('tipoCliente', () => {
  it('quien solo compró pases por sesión es eventual', () => {
    expect(tipoCliente([{ esPaseDiario: true }, { esPaseDiario: true }])).toBe('eventual');
  });

  it('una sola mensualidad ya lo hace socio, para siempre', () => {
    expect(tipoCliente([{ esPaseDiario: true }, { esPaseDiario: false }])).toBe('socio');
  });

  it('sin membresías todavía es eventual', () => {
    expect(tipoCliente([])).toBe('eventual');
  });
});

describe('nombreCompleto', () => {
  it('no deja un espacio colgando cuando no hay apellido', () => {
    expect(nombreCompleto({ nombre: 'Marcelo', apellido: null })).toBe('Marcelo');
    expect(nombreCompleto({ nombre: 'Ana', apellido: 'Quispe' })).toBe('Ana Quispe');
  });
});

describe('siguienteNroSocio', () => {
  it('el primer socio es el 1', () => {
    expect(siguienteNroSocio(null)).toBe(1);
  });
  it('sigue el correlativo', () => {
    expect(siguienteNroSocio(149)).toBe(150);
  });
});
