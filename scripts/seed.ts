/**
 * `pnpm db:seed` — datos de demostración: un gimnasio con 5 meses de historia.
 *
 * Qué garantiza:
 *   - Ninguna fecha de membresía ni monto está escrito a mano. Cada período
 *     sale de `calcularPeriodo`, cada precio de `resolverPrecio` y cada
 *     resultado de ingreso de `evaluarAcceso`: las mismas reglas que usa el
 *     sistema. Lo único que el seed decide es QUÉ DÍA compró cada persona.
 *   - Es determinístico (azar con semilla fija) y relativo a hoy: corrido
 *     cualquier día, siempre hay un socio que vence hoy y otro en 2 días.
 *   - Se niega a correr sobre una base que ya tiene datos. No borra nada.
 *
 * Las membresías, pagos e ingresos se insertan directo con Drizzle porque
 * esos módulos todavía no tienen repositorio. Cuando existan, el seed debería
 * pasar por sus servicios, como ya hace con clientes.
 */

import { randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { count, eq } from 'drizzle-orm';
import { rutaDb } from '@/lib/config';
import { crearDb, migrar, schema } from '@/lib/db';
import { type FechaISO, diasEntre, esAnterior, hoyEnZona, sumarDias } from '@/lib/fechas';
import { evaluarAcceso } from '@/modules/checkin';
import { moduloClientes } from '@/modules/clientes';
import {
  type PrecioVigencia,
  calcularPeriodo,
  resolverPrecio,
} from '@/modules/membresias';

const decir = (linea = '') => process.stdout.write(`${linea}\n`);

// ─── azar con semilla ────────────────────────────────────────────────────────

function crearAzar(semilla: number) {
  let estado = semilla >>> 0;

  // mulberry32
  const siguiente = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const entre = (min: number, max: number) =>
    min + Math.floor(siguiente() * (max - min + 1));

  return {
    /** Entero entre min y max, ambos incluidos. */
    entre,
    prob: (p: number) => siguiente() < p,
    elegir<T>(lista: readonly T[]): T {
      return lista[entre(0, lista.length - 1)]!;
    },
    ponderado<T>(opciones: ReadonlyArray<readonly [T, number]>): T {
      const total = opciones.reduce((suma, [, peso]) => suma + peso, 0);
      let tirada = siguiente() * total;
      for (const [valor, peso] of opciones) {
        tirada -= peso;
        if (tirada < 0) return valor;
      }
      return opciones[opciones.length - 1]![0];
    },
  };
}

const azar = crearAzar(20261011);

// ─── calendario ──────────────────────────────────────────────────────────────

const hoy = hoyEnZona();
const DIAS_HISTORIAL = 150; // 5 meses
const INICIO = sumarDias(hoy, -DIAS_HISTORIAL);

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]; // prettier-ignore

/** Primer y último día del mes de `f`, sin tocar `Date`. */
function limitesDelMes(f: FechaISO): [FechaISO, FechaISO] {
  const primero = `${f.slice(0, 8)}01`;
  // el día 28 más 4 días cae siempre en el mes siguiente
  const enMesSiguiente = sumarDias(`${f.slice(0, 8)}28`, 4);
  return [primero, sumarDias(`${enMesSiguiente.slice(0, 8)}01`, -1)];
}

/** 2024-01-07 fue domingo. */
const esDomingo = (f: FechaISO) => ((diasEntre('2024-01-07', f) % 7) + 7) % 7 === 0;

const fechaAlAzar = (desde: FechaISO, hasta: FechaISO) =>
  sumarDias(desde, azar.entre(0, diasEntre(desde, hasta)));

const ahora = new Date();

/**
 * Timestamp de auditoría para un día dado (La Paz es UTC-4 fijo, sin horario
 * de verano). No es lógica de membresías: esas usan solo la fecha de calendario.
 */
function momento(fecha: FechaISO, hora?: number): Date {
  const h =
    hora ??
    azar.ponderado([
      [azar.entre(6, 9), 35],
      [azar.entre(10, 16), 20],
      [azar.entre(17, 21), 45],
    ]);
  const p = (n: number) => String(n).padStart(2, '0');
  const d = new Date(
    `${fecha}T${p(h)}:${p(azar.entre(0, 59))}:${p(azar.entre(0, 59))}-04:00`,
  );
  // Nada del día de hoy puede quedar registrado en el futuro.
  return d > ahora ? new Date(ahora.getTime() - azar.entre(1, 90) * 60_000) : d;
}

// ─── catálogo ────────────────────────────────────────────────────────────────

type PlanClave = 'sesion' | 'mensual' | 'trimestral' | 'anual';

const PLANES: ReadonlyArray<{
  clave: PlanClave;
  nombre: string;
  diasDuracion: number;
  esPaseDiario: boolean;
  precioCentavos: number;
}> = [
  { clave: 'sesion', nombre: 'Pase por sesión', diasDuracion: 1, esPaseDiario: true, precioCentavos: 2_000 },
  { clave: 'mensual', nombre: 'Mensual', diasDuracion: 30, esPaseDiario: false, precioCentavos: 20_000 },
  { clave: 'trimestral', nombre: 'Trimestral', diasDuracion: 90, esPaseDiario: false, precioCentavos: 54_000 },
  { clave: 'anual', nombre: 'Anual', diasDuracion: 365, esPaseDiario: false, precioCentavos: 190_000 },
]; // prettier-ignore

const PROMO = { clave: 'trimestral', precioCentavos: 48_000 } as const;

const DIAS: Record<PlanClave, number> = {
  sesion: 1,
  mensual: 30,
  trimestral: 90,
  anual: 365,
};

// ─── personas ────────────────────────────────────────────────────────────────

const NOMBRES = [
  'Ana', 'Carla', 'Daniela', 'Fabiola', 'Gabriela', 'Jimena', 'Karen', 'Lucía', 'María',
  'Natalia', 'Paola', 'Rocío', 'Silvia', 'Valeria', 'Ximena', 'Andrea', 'Camila', 'Noelia',
  'Alejandro', 'Boris', 'Carlos', 'Diego', 'Edwin', 'Fernando', 'Gonzalo', 'Hugo', 'Iván',
  'Javier', 'Luis', 'Marcelo', 'Nelson', 'Óscar', 'Pablo', 'Ramiro', 'Sergio', 'Wilson',
  'Álvaro', 'Rodrigo', 'Mauricio', 'Franz',
]; // prettier-ignore

const APELLIDOS = [
  'Quispe', 'Mamani', 'Condori', 'Flores', 'Choque', 'Vargas', 'Rojas', 'Gutiérrez', 'Fernández',
  'Apaza', 'Calle', 'Ticona', 'Limachi', 'Huanca', 'Cruz', 'Aguilar', 'Mendoza', 'Salazar',
  'Paredes', 'Villca', 'Copa', 'Nina', 'Rivera', 'Torrez', 'Zeballos', 'Arce', 'Montaño',
  'Suárez', 'Ortiz', 'Guzmán', 'Yujra', 'Laura', 'Chambi', 'Poma', 'Ramos', 'Camacho',
]; // prettier-ignore

interface DatosPersona {
  nombre: string;
  apellido?: string;
  ci?: string;
  ciExtension?: string;
  telefono?: string;
}

const cisUsados = new Set<string>();

function ciNuevo(): string {
  for (;;) {
    const ci = String(azar.entre(3_000_000, 13_999_999));
    if (!cisUsados.has(ci)) {
      cisUsados.add(ci);
      return ci;
    }
  }
}

const telefonoNuevo = () =>
  `${azar.elegir(['6', '7'])}${azar.entre(1_000_000, 9_999_999)}`;

/** Ficha completa, como la de alguien que se inscribe a una mensualidad. */
function personaCompleta(opciones: { sinCi?: boolean } = {}): DatosPersona {
  const persona: DatosPersona = {
    nombre: azar.elegir(NOMBRES),
    apellido: azar.prob(0.6)
      ? `${azar.elegir(APELLIDOS)} ${azar.elegir(APELLIDOS)}`
      : azar.elegir(APELLIDOS),
    telefono: azar.prob(0.9) ? telefonoNuevo() : undefined,
  };
  if (!opciones.sinCi) {
    persona.ci = ciNuevo();
    persona.ciExtension = azar.ponderado([
      ['LP', 80], ['CB', 6], ['SC', 6], ['OR', 4], ['PT', 4],
    ]); // prettier-ignore
  }
  return persona;
}

/** Ficha ligera: quien paga una sesión deja el nombre y poco más. */
function personaLigera(): DatosPersona {
  const persona: DatosPersona = { nombre: azar.elegir(NOMBRES) };
  if (azar.prob(0.6)) persona.apellido = azar.elegir(APELLIDOS);
  if (azar.prob(0.25)) persona.telefono = telefonoNuevo();
  if (azar.prob(0.15)) {
    persona.ci = ciNuevo();
    persona.ciExtension = 'LP';
  }
  return persona;
}

// ─── perfiles: qué compró cada uno y cuándo ──────────────────────────────────

interface Compra {
  fecha: FechaISO;
  plan: PlanClave;
  /** Si viene, la venta se cargó mal: membresía cancelada y pago anulado. */
  motivoAnulacion?: string;
}

interface Perfil {
  etiqueta: string;
  datos: DatosPersona;
  /** En orden cronológico. La primera define la fecha de registro. */
  compras: Compra[];
  /** Probabilidad de venir un día cualquiera con membresía vigente. */
  asistencia: number;
  /** Para verificar que el encadenamiento cayó donde se planeó. */
  finEsperado?: FechaISO;
  vieneHoy?: boolean;
  bloqueo?: { desde: FechaISO; motivo: string };
  referido?: boolean;
}

/**
 * Arma, hacia atrás desde `fin`, las fechas de compra de una cadena de
 * renovaciones del mismo plan. Solo elige DÍAS DE COMPRA: renovó a tiempo
 * (unos días antes de vencer) o tarde (cuando ya había vencido). El período
 * de cada una lo calcula después `calcularPeriodo`, y `finEsperado` verifica
 * que haya coincidido.
 */
function cadena(plan: PlanClave, fin: FechaISO, maxPeriodos: number): Compra[] {
  const dias = DIAS[plan];
  const compras: Compra[] = [];
  let inicio = sumarDias(fin, -(dias - 1));

  for (let n = 1; ; n++) {
    const aTiempo = azar.prob(0.75);
    const finAnterior = sumarDias(inicio, -1 - (aTiempo ? 0 : azar.entre(1, 12)));
    const inicioAnterior = sumarDias(finAnterior, -(dias - 1));

    if (n >= maxPeriodos || esAnterior(inicioAnterior, INICIO)) {
      compras.push({ fecha: inicio, plan }); // la primera: arranca el día que paga
      break;
    }

    compras.push({
      fecha: aTiempo ? sumarDias(finAnterior, -azar.entre(0, 5)) : inicio,
      plan,
    });
    inicio = inicioAnterior;
  }

  return compras.reverse();
}

function socio(
  etiqueta: string,
  plan: PlanClave,
  fin: FechaISO,
  extra: Partial<Perfil> = {},
): Perfil {
  return {
    etiqueta,
    datos: personaCompleta(),
    compras: cadena(plan, fin, azar.ponderado([[99, 70], [1, 12], [2, 18]])), // prettier-ignore
    asistencia: azar.entre(15, 60) / 100,
    finEsperado: fin,
    ...extra,
  };
}

/** Un vencido solo pudo tener planes que entran en la ventana de historial. */
function planDeVencido(fin: FechaISO): PlanClave {
  const entraTrimestral = !esAnterior(sumarDias(fin, -(DIAS.trimestral - 1)), INICIO);
  return entraTrimestral ? azar.ponderado([['mensual', 80], ['trimestral', 20]]) : 'mensual'; // prettier-ignore
}

function armarPerfiles(): Perfil[] {
  const perfiles: Perfil[] = [];
  const [primeroDelMes] = limitesDelMes(hoy);

  // Los dos casos exactos que recepción tiene que poder ver en la demo.
  perfiles.push(socio('vence hoy', 'mensual', hoy, { vieneHoy: true }));
  perfiles.push(
    socio('vence en 2 días', 'mensual', sumarDias(hoy, 2), { vieneHoy: true }),
  );

  // Al día pero bloqueado a mano: rebota aunque tenga membresía vigente.
  perfiles.push(
    socio('bloqueado', 'mensual', sumarDias(hoy, azar.entre(10, 25)), {
      asistencia: 0.5,
      bloqueo: {
        desde: sumarDias(hoy, -6),
        motivo: 'Incumplimiento reiterado del reglamento. Hablar con administración.',
      },
    }),
  );

  // Compraron el Trimestral este mes: les toca el precio de promoción.
  const diasDelMesTranscurridos = Math.min(diasEntre(primeroDelMes, hoy), 9);
  for (let i = 0; i < 3; i++) {
    const compra = sumarDias(hoy, -azar.entre(0, diasDelMesTranscurridos));
    perfiles.push({
      etiqueta: 'promo del mes',
      datos: personaCompleta(),
      compras: [{ fecha: compra, plan: 'trimestral' }],
      asistencia: azar.entre(30, 60) / 100,
      finEsperado: sumarDias(compra, DIAS.trimestral - 1),
    });
  }

  // Socios al día. Los rangos garantizan que el período vigente ya empezó.
  for (let i = 0; i < 72; i++) {
    const plan = azar.ponderado<PlanClave>([['mensual', 68], ['trimestral', 22], ['anual', 10]]); // prettier-ignore
    const fin =
      plan === 'anual'
        ? sumarDias(hoy, azar.entre(DIAS.anual - DIAS_HISTORIAL, DIAS.anual - 1))
        : sumarDias(hoy, azar.entre(4, DIAS[plan] - 1));
    perfiles.push(socio('al día', plan, fin));
  }

  // Vencidos hace poco, hace algunas semanas y hace meses.
  for (let i = 0; i < 15; i++) {
    const fin = sumarDias(hoy, -azar.entre(1, 10));
    perfiles.push(socio('vencido hace poco', planDeVencido(fin), fin));
  }
  for (let i = 0; i < 12; i++) {
    const fin = sumarDias(hoy, -azar.entre(11, 44));
    perfiles.push(socio('vencido hace semanas', planDeVencido(fin), fin));
  }
  for (let i = 0; i < 25; i++) {
    const fin = sumarDias(hoy, -azar.entre(45, 120));
    perfiles.push(socio('vencido hace meses', 'mensual', fin));
  }

  // Menores de edad: sin CI, manda el número de socio.
  for (const p of perfiles.filter((x) => x.etiqueta === 'al día').slice(0, 6)) {
    if (p.datos.ci) cisUsados.delete(p.datos.ci);
    delete p.datos.ci;
    delete p.datos.ciExtension;
  }

  // Dos ventas mal cargadas y corregidas: nada se borra, se anula con motivo.
  for (const p of perfiles
    .filter((x) => x.etiqueta === 'al día' && x.compras[0]?.plan === 'mensual')
    .slice(0, 2)) {
    // prettier-ignore
    p.compras.unshift({
      fecha: p.compras[0]!.fecha,
      plan: 'trimestral',
      motivoAnulacion: 'Se cargó Trimestral por error; el socio pagó Mensual.',
    });
  }

  // Socios vencidos que vuelven un día suelto con un pase por sesión.
  const vencidos = perfiles.filter((x) => x.etiqueta.startsWith('vencido hace'));
  for (const p of vencidos.filter((_, i) => i % 6 === 0)) {
    const despuesDeVencer = sumarDias(p.finEsperado!, 1);
    p.compras.push({ fecha: fechaAlAzar(despuesDeVencer, hoy), plan: 'sesion' });
  }

  // Algunos socios llegaron traídos por otro socio.
  for (const p of perfiles.filter((_, i) => i % 13 === 5)) p.referido = true;

  // Eventuales: solo pases por sesión. Varios volvieron más de una vez.
  for (let i = 0; i < 20; i++) {
    const cuantos = i < 9 ? azar.entre(2, 5) : 1;
    const fechas = new Set<FechaISO>();
    while (fechas.size < cuantos) fechas.add(fechaAlAzar(sumarDias(INICIO, 20), hoy));
    if (i === 0) fechas.add(hoy); // uno con pase válido hoy, para probar el check-in

    perfiles.push({
      etiqueta: 'eventual',
      datos: personaLigera(),
      compras: [...fechas].sort().map((fecha) => ({ fecha, plan: 'sesion' })),
      asistencia: 1,
      referido: i % 3 === 1,
    });
  }

  return perfiles;
}

// ─── carga ───────────────────────────────────────────────────────────────────

function sembrar() {
  const archivo = rutaDb();
  mkdirSync(dirname(archivo), { recursive: true });

  const db = crearDb(archivo);
  migrar(db);

  const yaHay =
    (db.select({ n: count() }).from(schema.clientes).get()?.n ?? 0) +
    (db.select({ n: count() }).from(schema.planes).get()?.n ?? 0);

  if (yaHay > 0) {
    console.error(
      `La base ${archivo} ya tiene datos. El seed no borra ni pisa nada.\n` +
        'Para sembrar de cero, apuntá GYM_DB a un archivo nuevo o mové el actual a otra carpeta.',
    );
    process.exitCode = 1;
    db.$client.close();
    return;
  }

  const perfiles = armarPerfiles().sort((a, b) =>
    a.compras[0]!.fecha < b.compras[0]!.fecha ? -1 : a.compras[0]!.fecha > b.compras[0]!.fecha ? 1 : 0,
  ); // prettier-ignore

  const resumen = db.transaction(() => {
    // usuarios: para que creado_por / registrado_por nunca queden en null.
    // La contraseña es aleatoria y no se muestra: hasta que exista el módulo
    // de auth estas cuentas solo sirven de referencia para la auditoría.
    const hashInutilizable = () => {
      const sal = randomBytes(16);
      return `scrypt$${sal.toString('hex')}$${scryptSync(randomBytes(24), sal, 64).toString('hex')}`;
    };
    db.insert(schema.usuarios)
      .values({ usuario: 'admin', nombre: 'Administración', passwordHash: hashInutilizable(), rol: 'admin' })
      .run(); // prettier-ignore
    const recepcion = db
      .insert(schema.usuarios)
      .values({ usuario: 'recepcion', nombre: 'Recepción', passwordHash: hashInutilizable(), rol: 'recepcion' })
      .returning()
      .get(); // prettier-ignore

    // planes y precios
    const vigenteDesde = sumarDias(INICIO, -30);
    const [primeroDelMes, ultimoDelMes] = limitesDelMes(hoy);
    const planes = new Map<PlanClave, typeof schema.planes.$inferSelect>();
    const precios: PrecioVigencia[] = [];

    PLANES.forEach((p, orden) => {
      const plan = db
        .insert(schema.planes)
        .values({ nombre: p.nombre, diasDuracion: p.diasDuracion, esPaseDiario: p.esPaseDiario, orden })
        .returning()
        .get(); // prettier-ignore
      planes.set(p.clave, plan);
      precios.push(
        db
          .insert(schema.planPrecios)
          .values({ planId: plan.id, precioCentavos: p.precioCentavos, vigenteDesde })
          .returning()
          .get(),
      );
    });

    precios.push(
      db
        .insert(schema.planPrecios)
        .values({
          planId: planes.get(PROMO.clave)!.id,
          precioCentavos: PROMO.precioCentavos,
          vigenteDesde: primeroDelMes,
          vigenteHasta: ultimoDelMes,
          esPromocion: true,
          etiqueta: `Promo de ${MESES[Number(hoy.slice(5, 7)) - 1]}`,
        })
        .returning()
        .get(),
    );

    // clientes, por el mismo servicio que usa la API: validación y nro de
    // socio reales. Se registran en orden de llegada.
    const { servicio } = moduloClientes(db);
    const sociosRegistrados: Array<{
      id: number;
      nombre: string;
      fechaRegistro: FechaISO;
    }> = [];

    const clientes = perfiles.map((perfil) => {
      const fechaRegistro = perfil.compras[0]!.fecha;
      const padrino =
        perfil.referido && sociosRegistrados.length > 0
          ? azar.elegir(sociosRegistrados)
          : null;

      const cliente = servicio.registrar(
        { ...perfil.datos, referidoPorClienteId: padrino?.id ?? null },
        fechaRegistro,
      );

      if (perfil.etiqueta !== 'eventual') {
        sociosRegistrados.push({
          id: cliente.id,
          nombre: cliente.nombreCompleto,
          fechaRegistro,
        });
      }
      return { perfil, cliente };
    });

    // ventas, en orden cronológico global
    interface MembresiaViva {
      id: number;
      fechaCompra: FechaISO;
      fechaFin: FechaISO;
      esPaseDiario: boolean;
    }
    const vivas = new Map<number, MembresiaViva[]>();
    let conPromo = 0;
    let anuladas = 0;

    const ventas = clientes
      .flatMap(({ perfil, cliente }) => perfil.compras.map((compra) => ({ compra, cliente })))
      .sort((a, b) => (a.compra.fecha < b.compra.fecha ? -1 : a.compra.fecha > b.compra.fecha ? 1 : 0)); // prettier-ignore

    for (const { compra, cliente } of ventas) {
      const plan = planes.get(compra.plan)!;
      const anteriores = vivas.get(cliente.id) ?? [];
      const ultima = anteriores[anteriores.length - 1];

      const periodo = calcularPeriodo({
        hoy: compra.fecha,
        diasDuracion: plan.diasDuracion,
        fechaFinAnterior: ultima?.fechaFin ?? null,
        encadenable: !plan.esPaseDiario,
      });
      const precio = resolverPrecio(precios, compra.fecha, plan.id);
      const registrada = momento(compra.fecha);
      const anulada = compra.motivoAnulacion !== undefined;

      const membresia = db
        .insert(schema.membresias)
        .values({
          clienteId: cliente.id,
          planId: plan.id,
          fechaInicio: periodo.fechaInicio,
          fechaFin: periodo.fechaFin,
          estado: anulada ? 'cancelada' : 'vigente',
          precioCentavos: precio.precioCentavos,
          planPrecioId: precio.planPrecioId,
          creadoPor: recepcion.id,
          createdAt: registrada,
        })
        .returning()
        .get();

      db.insert(schema.pagos)
        .values({
          clienteId: cliente.id,
          membresiaId: membresia.id,
          montoCentavos: precio.precioCentavos,
          fechaPago: compra.fecha,
          metodo: azar.ponderado([['efectivo', 55], ['qr', 35], ['transferencia', 7], ['tarjeta', 3]]),
          registradoPor: recepcion.id,
          nota: precio.esPromocion ? precio.etiqueta : null,
          anulado: anulada,
          motivoAnulacion: compra.motivoAnulacion ?? null,
          createdAt: registrada,
        })
        .run(); // prettier-ignore

      if (anulada) {
        anuladas++;
        continue; // una membresía cancelada no cuenta para encadenar ni para entrar
      }
      if (precio.esPromocion) conPromo++;

      vivas.set(cliente.id, [
        ...anteriores,
        {
          id: membresia.id,
          fechaCompra: compra.fecha,
          fechaFin: periodo.fechaFin,
          esPaseDiario: plan.esPaseDiario,
        },
      ]);
    }

    // Verificación: el encadenamiento tiene que haber caído donde se planeó.
    for (const { perfil, cliente } of clientes) {
      if (!perfil.finEsperado) continue;
      const fin = (vivas.get(cliente.id) ?? [])
        .filter((m) => !m.esPaseDiario)
        .at(-1)?.fechaFin;
      if (fin !== perfil.finEsperado) {
        throw new Error(
          `Seed inconsistente: socio ${cliente.nroSocio} (${perfil.etiqueta}) ` +
            `debía vencer el ${perfil.finEsperado} y vence el ${fin}`,
        );
      }
    }

    // ingresos: cada intento pasa por evaluarAcceso, permitidos y rechazados
    const ingresos: Array<typeof schema.ingresos.$inferInsert & { fechaHora: Date }> = [];

    for (const { perfil, cliente } of clientes) {
      const membresias = vivas.get(cliente.id) ?? [];

      for (
        let dia = perfil.compras[0]!.fecha;
        !esAnterior(hoy, dia);
        dia = sumarDias(dia, 1)
      ) {
        // la más reciente a ese día, igual que la consulta del check-in
        const actual = membresias
          .filter((m) => !esAnterior(dia, m.fechaCompra))
          .reduce<MembresiaViva | null>(
            (mejor, m) =>
              mejor === null || !esAnterior(m.fechaFin, mejor.fechaFin) ? m : mejor,
            null,
          );
        if (!actual) continue;

        const bloqueado =
          perfil.bloqueo !== undefined && !esAnterior(dia, perfil.bloqueo.desde);
        const diasVencida = diasEntre(actual.fechaFin, dia);

        let viene: boolean;
        if (bloqueado) {
          // lo rebotaron el día del bloqueo y volvió a probar dos días después
          const desde = diasEntre(perfil.bloqueo!.desde, dia);
          viene = desde === 0 || desde === 2;
        } else if (actual.esPaseDiario) {
          viene = diasVencida <= 0; // pagó la sesión para entrar ese día
        } else if (diasVencida <= 0) {
          viene =
            (perfil.vieneHoy === true && dia === hoy) ||
            azar.prob(perfil.asistencia * (esDomingo(dia) ? 0.25 : 1));
        } else {
          // recién vencido: algunos vienen igual y rebotan en el mostrador
          viene = diasVencida <= 4 && azar.prob(0.2);
        }
        if (!viene) continue;

        const veredicto = evaluarAcceso(
          {
            clienteId: cliente.id,
            nroSocio: cliente.nroSocio,
            nombreCompleto: cliente.nombreCompleto,
            fotoUrl: cliente.fotoUrl,
            fechaFin: actual.fechaFin,
            membresiaId: actual.id,
            esPaseDiario: actual.esPaseDiario,
            bloqueado,
          },
          dia,
        );

        ingresos.push({
          clienteId: cliente.id,
          membresiaId: actual.id,
          fecha: dia,
          fechaHora: momento(dia),
          resultado: veredicto.resultado,
        });
      }
    }

    ingresos.sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime());
    for (let i = 0; i < ingresos.length; i += 500) {
      db.insert(schema.ingresos).values(ingresos.slice(i, i + 500)).run(); // prettier-ignore
    }

    // el bloqueo manual (todavía no hay caso de uso para esto en clientes)
    for (const { perfil, cliente } of clientes) {
      if (!perfil.bloqueo) continue;
      db.update(schema.clientes)
        .set({ bloqueado: true, motivoBloqueo: perfil.bloqueo.motivo })
        .where(eq(schema.clientes.id, cliente.id))
        .run();
    }

    // visitas: entradas GRATIS. Quien pagó algo es cliente, no visita.
    const visitas: Array<typeof schema.visitas.$inferInsert> = [];

    for (let i = 0; i < 7; i++) {
      const fecha = fechaAlAzar(INICIO, hoy);
      visitas.push({
        nombre: `${azar.elegir(NOMBRES)} ${azar.elegir(APELLIDOS)}`,
        fecha,
        fechaHora: momento(fecha),
        motivo: 'cortesia',
        registradoPor: recepcion.id,
        nota: azar.elegir(['Invitación del dueño', 'Cortesía por cumpleaños', 'Canje de sorteo', null]),
      }); // prettier-ignore
    }

    // acompañantes de un socio que ya estaba inscrito ese día
    for (let i = 0; i < 4; i++) {
      const anfitrion = azar.elegir(sociosRegistrados);
      const fecha = fechaAlAzar(anfitrion.fechaRegistro, hoy);
      visitas.push({
        nombre: `${azar.elegir(NOMBRES)} ${azar.elegir(APELLIDOS)}`,
        fecha,
        fechaHora: momento(fecha),
        motivo: 'acompanante',
        invitadoPorClienteId: anfitrion.id,
        registradoPor: recepcion.id,
      });
    }

    // clases de prueba; dos terminaron inscribiéndose a los pocos días
    const convertidos = sociosRegistrados
      .filter((s) => !esAnterior(s.fechaRegistro, sumarDias(INICIO, 10)))
      .slice(0, 2);
    for (const s of convertidos) {
      const fecha = sumarDias(s.fechaRegistro, -azar.entre(1, 5));
      visitas.push({
        nombre: s.nombre,
        fecha,
        fechaHora: momento(fecha),
        motivo: 'prueba',
        convertidoAClienteId: s.id,
        registradoPor: recepcion.id,
      });
    }
    for (let i = 0; i < 3; i++) {
      const fecha = fechaAlAzar(INICIO, hoy);
      visitas.push({
        nombre: `${azar.elegir(NOMBRES)} ${azar.elegir(APELLIDOS)}`,
        telefono: telefonoNuevo(),
        fecha,
        fechaHora: momento(fecha),
        motivo: 'prueba',
        registradoPor: recepcion.id,
      });
    }

    visitas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    db.insert(schema.visitas).values(visitas).run();

    const porEtiqueta = new Map<string, number[]>();
    for (const { perfil, cliente } of clientes) {
      porEtiqueta.set(perfil.etiqueta, [...(porEtiqueta.get(perfil.etiqueta) ?? []), cliente.nroSocio]);
    } // prettier-ignore

    return {
      porEtiqueta,
      ventas: ventas.length,
      conPromo,
      anuladas,
      ingresos: ingresos.length,
      rechazados: ingresos.filter((i) => i.resultado === 'vencido').length,
      visitas: visitas.length,
    };
  });

  db.$client.close();

  decir(`Base sembrada: ${archivo}`);
  decir(`Historial del ${INICIO} al ${hoy}`);
  decir();
  for (const [etiqueta, numeros] of resumen.porEtiqueta) {
    const detalle = numeros.length <= 3 ? `  → socio nº ${numeros.join(', ')}` : '';
    decir(`  ${String(numeros.length).padStart(3)}  ${etiqueta}${detalle}`);
  }
  decir();
  decir(
    `  ${resumen.ventas} ventas (${resumen.conPromo} con promo, ${resumen.anuladas} anuladas)`,
  );
  decir(`  ${resumen.ingresos} ingresos (${resumen.rechazados} rechazados)`);
  decir(`  ${resumen.visitas} visitas gratis`);
}

sembrar();
