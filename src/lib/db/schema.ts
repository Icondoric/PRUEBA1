/**
 * Esquema completo. SQLite vía Drizzle.
 *
 * Deliberadamente portable a Postgres: sin tipos ni funciones propias de
 * SQLite. Si el gimnasio crece y hay que migrar a la nube, se cambia este
 * archivo de `sqliteTable` a `pgTable` y se exporta la data. Nada más.
 *
 * Decisiones que NO hay que revertir después:
 *   - fechas de calendario como TEXT 'YYYY-MM-DD'; timestamps aparte, en epoch
 *   - dinero como entero en centavos
 *   - renovar inserta una fila nueva; nunca se actualiza fecha_fin
 *   - no existe columna "vencido": se calcula
 *   - los precios tienen vigencia; la membresía congela el precio cobrado
 *   - invitados van a `visitas`, no a `clientes`
 */

import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/** Timestamp real (auditoría). Distinto de una fecha de calendario. */
const ts = (nombre: string) =>
  integer(nombre, { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`);

/** Fecha de calendario 'YYYY-MM-DD'. Nunca lleva hora ni zona. */
const fecha = (nombre: string) => text(nombre);

// ─── usuarios del sistema ────────────────────────────────────────────────────

export const usuarios = sqliteTable(
  'usuarios',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    usuario: text('usuario').notNull(),
    nombre: text('nombre').notNull(),
    passwordHash: text('password_hash').notNull(),
    rol: text('rol', { enum: ['admin', 'recepcion'] })
      .notNull()
      .default('recepcion'),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    createdAt: ts('created_at'),
  },
  (t) => [uniqueIndex('usuarios_usuario_unq').on(t.usuario)],
);

// ─── clientes ────────────────────────────────────────────────────────────────

export const clientes = sqliteTable(
  'clientes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** Número corto del carnet. Es lo que el socio teclea en el check-in. */
    nroSocio: integer('nro_socio').notNull(),
    /** Puede faltar (menores de edad). Entonces manda el nro de socio. */
    ci: text('ci'),
    /** LP, CB, SC… El CI solo no es único en Bolivia. */
    ciExtension: text('ci_extension').default('LP'),
    nombre: text('nombre').notNull(),
    /**
     * Opcional a propósito: un pase por sesión se vende con el nombre nomás.
     * Pedirle apellido, CI y teléfono a alguien que paga Bs 20 por entrenar
     * una vez hace que recepción invente datos para salir del paso.
     */
    apellido: text('apellido'),
    telefono: text('telefono'),
    fechaNacimiento: fecha('fecha_nacimiento'),
    /** Ruta relativa dentro de la carpeta de datos, no una URL absoluta. */
    fotoUrl: text('foto_url'),
    /** De acá sale la antigüedad del socio. */
    fechaRegistro: fecha('fecha_registro').notNull(),
    /**
     * Quién lo trajo. Se llena cuando entra como acompañante de un socio.
     * Sirve para promos de referidos y para medir de dónde vienen los socios.
     */
    referidoPorClienteId: integer('referido_por_cliente_id'),
    /** Bloqueo manual: rebota en el check-in aunque esté vigente. */
    bloqueado: integer('bloqueado', { mode: 'boolean' }).notNull().default(false),
    motivoBloqueo: text('motivo_bloqueo'),
    notas: text('notas'),
    /** Soft delete. Los clientes no se borran. */
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    uniqueIndex('clientes_nro_socio_unq').on(t.nroSocio),
    index('clientes_referido_idx').on(t.referidoPorClienteId),
    // El CI es único cuando existe; SQLite permite varios NULL, que es lo que
    // queremos para los socios sin CI.
    uniqueIndex('clientes_ci_unq').on(t.ci, t.ciExtension),
    index('clientes_apellido_idx').on(t.apellido, t.nombre),
  ],
);

// ─── planes y precios con vigencia ───────────────────────────────────────────

export const planes = sqliteTable('planes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(), // "Mensual", "Pase diario", "Trimestral"
  /** Duración en DÍAS. Nunca "un mes": el 31 de enero deja de ser ambiguo. */
  diasDuracion: integer('dias_duracion').notNull(),
  /** Un pase diario no es una membresía renovable; no entra en "socios activos". */
  esPaseDiario: integer('es_pase_diario', { mode: 'boolean' }).notNull().default(false),
  orden: integer('orden').notNull().default(0),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
});

/**
 * Historial de precios. Así se modelan las promociones de temporada:
 * una fila con vigencia acotada y precio distinto.
 *
 * El precio base del plan es la fila con `vigenteHasta = null`.
 * Una promo es una fila con ambas fechas y `esPromocion = true`.
 */
export const planPrecios = sqliteTable(
  'plan_precios',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    planId: integer('plan_id')
      .notNull()
      .references(() => planes.id),
    precioCentavos: integer('precio_centavos').notNull(),
    vigenteDesde: fecha('vigente_desde').notNull(),
    /** null = precio base vigente hasta nuevo aviso. */
    vigenteHasta: fecha('vigente_hasta'),
    esPromocion: integer('es_promocion', { mode: 'boolean' }).notNull().default(false),
    /** "Promo aniversario", "Descuento enero". Se muestra en el comprobante. */
    etiqueta: text('etiqueta'),
    createdAt: ts('created_at'),
  },
  (t) => [index('plan_precios_plan_idx').on(t.planId, t.vigenteDesde)],
);

// ─── membresías ──────────────────────────────────────────────────────────────

export const membresias = sqliteTable(
  'membresias',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id),
    planId: integer('plan_id')
      .notNull()
      .references(() => planes.id),
    fechaInicio: fecha('fecha_inicio').notNull(),
    fechaFin: fecha('fecha_fin').notNull(),
    estado: text('estado', { enum: ['vigente', 'cancelada', 'congelada'] })
      .notNull()
      .default('vigente'),
    /** Precio efectivamente cobrado. El del plan puede cambiar después. */
    precioCentavos: integer('precio_centavos').notNull(),
    /** Qué fila de plan_precios se aplicó. Deja rastro de la promo usada. */
    planPrecioId: integer('plan_precio_id').references(() => planPrecios.id),
    creadoPor: integer('creado_por').references(() => usuarios.id),
    createdAt: ts('created_at'),
  },
  (t) => [
    // "¿cuál es su membresía más reciente?" — la query del check-in
    index('membresias_cliente_fin_idx').on(t.clienteId, t.fechaFin),
    index('membresias_fin_idx').on(t.fechaFin),
  ],
);

// ─── pagos ───────────────────────────────────────────────────────────────────

export const pagos = sqliteTable(
  'pagos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id),
    /** Qué período pagó. Null solo para cobros sueltos. */
    membresiaId: integer('membresia_id').references(() => membresias.id),
    montoCentavos: integer('monto_centavos').notNull(),
    fechaPago: fecha('fecha_pago').notNull(),
    metodo: text('metodo', { enum: ['efectivo', 'qr', 'transferencia', 'tarjeta'] })
      .notNull()
      .default('efectivo'),
    registradoPor: integer('registrado_por').references(() => usuarios.id),
    nota: text('nota'),
    /** Un pago mal cargado se anula con motivo; no se borra. */
    anulado: integer('anulado', { mode: 'boolean' }).notNull().default(false),
    motivoAnulacion: text('motivo_anulacion'),
    /** Quién lo anuló y cuándo. Null mientras el pago está vigente. */
    anuladoPor: integer('anulado_por').references(() => usuarios.id),
    anuladoEn: integer('anulado_en', { mode: 'timestamp' }),
    createdAt: ts('created_at'),
  },
  (t) => [
    index('pagos_cliente_idx').on(t.clienteId, t.fechaPago),
    index('pagos_fecha_idx').on(t.fechaPago),
  ],
);

// ─── ingresos (socios) ───────────────────────────────────────────────────────

export const ingresos = sqliteTable(
  'ingresos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id),
    membresiaId: integer('membresia_id').references(() => membresias.id),
    fechaHora: ts('fecha_hora'),
    /** Fecha de calendario del ingreso, para agrupar sin pelear con horas. */
    fecha: fecha('fecha').notNull(),
    /** Se registran TODOS, permitidos y rechazados. */
    resultado: text('resultado', {
      enum: ['permitido', 'por_vencer', 'vencido', 'sin_membresia'],
    }).notNull(),
  },
  (t) => [
    index('ingresos_cliente_idx').on(t.clienteId, t.fecha),
    index('ingresos_fecha_idx').on(t.fecha),
  ],
);

// ─── visitas: SOLO entradas GRATIS ───────────────────────────────────────────
//
// Regla para no confundirse nunca:
//   pagó algo  → es un `cliente` + membresía de 1 día + `pago`
//   entró gratis → es una `visita`
//
// Un pase por sesión NO va acá: se paga, así que genera cliente, membresía y
// pago como cualquier otra venta. Acá van solo cortesías, pruebas gratis y
// acompañantes que no pagaron.

export const visitas = sqliteTable(
  'visitas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nombre: text('nombre').notNull(),
    ci: text('ci'),
    telefono: text('telefono'),
    fecha: fecha('fecha').notNull(),
    fechaHora: ts('fecha_hora'),
    motivo: text('motivo', { enum: ['cortesia', 'acompanante', 'prueba', 'otro'] })
      .notNull()
      .default('cortesia'),
    /** Si vino invitado por un socio, queda el vínculo (sirve para promos). */
    invitadoPorClienteId: integer('invitado_por_cliente_id').references(() => clientes.id),
    /** Si después se hizo socio, se enlaza. Mide conversión de pruebas. */
    convertidoAClienteId: integer('convertido_a_cliente_id').references(() => clientes.id),
    registradoPor: integer('registrado_por').references(() => usuarios.id),
    nota: text('nota'),
  },
  (t) => [index('visitas_fecha_idx').on(t.fecha)],
);

// ─── accesos y sesiones ──────────────────────────────────────────────────────

/**
 * Los accesos que el dueño le dio a cada usuario, uno por fila.
 *
 * El rol `admin` (el dueño) tiene todo siempre y no necesita filas acá. Qué
 * accesos existen lo define el código (modules/usuarios/domain/permisos.ts),
 * no la base: por eso `permiso` es texto y no una tabla aparte.
 */
export const usuarioPermisos = sqliteTable(
  'usuario_permisos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    usuarioId: integer('usuario_id')
      .notNull()
      .references(() => usuarios.id),
    permiso: text('permiso').notNull(),
    otorgadoPor: integer('otorgado_por').references(() => usuarios.id),
    createdAt: ts('created_at'),
  },
  (t) => [uniqueIndex('usuario_permisos_unq').on(t.usuarioId, t.permiso)],
);

/**
 * Sesiones abiertas. Se guarda el hash del token, nunca el token: quien lea la
 * base (o un respaldo) no puede hacerse pasar por nadie.
 */
export const sesiones = sqliteTable(
  'sesiones',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tokenHash: text('token_hash').notNull(),
    usuarioId: integer('usuario_id')
      .notNull()
      .references(() => usuarios.id),
    createdAt: ts('created_at'),
    /** La sesión vence por inactividad, contando desde acá. */
    ultimoUso: integer('ultimo_uso', { mode: 'timestamp' }).notNull(),
  },
  (t) => [
    uniqueIndex('sesiones_token_unq').on(t.tokenHash),
    index('sesiones_usuario_idx').on(t.usuarioId),
  ],
);

// ─── relaciones ──────────────────────────────────────────────────────────────

export const clientesRelations = relations(clientes, ({ many }) => ({
  membresias: many(membresias),
  pagos: many(pagos),
  ingresos: many(ingresos),
}));

export const planesRelations = relations(planes, ({ many }) => ({
  precios: many(planPrecios),
  membresias: many(membresias),
}));

export const planPreciosRelations = relations(planPrecios, ({ one }) => ({
  plan: one(planes, { fields: [planPrecios.planId], references: [planes.id] }),
}));

export const membresiasRelations = relations(membresias, ({ one, many }) => ({
  cliente: one(clientes, { fields: [membresias.clienteId], references: [clientes.id] }),
  plan: one(planes, { fields: [membresias.planId], references: [planes.id] }),
  pagos: many(pagos),
}));

export const pagosRelations = relations(pagos, ({ one }) => ({
  cliente: one(clientes, { fields: [pagos.clienteId], references: [clientes.id] }),
  membresia: one(membresias, {
    fields: [pagos.membresiaId],
    references: [membresias.id],
  }),
}));

export const ingresosRelations = relations(ingresos, ({ one }) => ({
  cliente: one(clientes, { fields: [ingresos.clienteId], references: [clientes.id] }),
}));

/**
 * Vista de estado actual, para no repetir el "última membresía" por todos lados.
 * Crearla en una migración SQL manual (es válida igual en SQLite y Postgres):
 *
 *   CREATE VIEW v_estado_socio AS
 *   SELECT
 *     c.id AS cliente_id, c.nro_socio, c.ci, c.ci_extension,
 *     c.nombre, c.apellido, c.foto_url, c.bloqueado, c.activo,
 *     m.id AS membresia_id, m.fecha_fin, p.es_pase_diario
 *   FROM clientes c
 *   LEFT JOIN membresias m ON m.id = (
 *     SELECT m2.id FROM membresias m2
 *     WHERE m2.cliente_id = c.id AND m2.estado <> 'cancelada'
 *     ORDER BY m2.fecha_fin DESC, m2.id DESC LIMIT 1
 *   )
 *   LEFT JOIN planes p ON p.id = m.plan_id
 *   WHERE c.activo = 1;
 *
 * `es_pase_diario` viaja hasta el check-in para que el mensaje sea
 * "pase por sesión, válido hoy" y no "tu membresía vence hoy".
 */
