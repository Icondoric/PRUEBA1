CREATE TABLE `clientes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nro_socio` integer NOT NULL,
	`ci` text,
	`ci_extension` text DEFAULT 'LP',
	`nombre` text NOT NULL,
	`apellido` text,
	`telefono` text,
	`fecha_nacimiento` text,
	`foto_url` text,
	`fecha_registro` text NOT NULL,
	`referido_por_cliente_id` integer,
	`bloqueado` integer DEFAULT false NOT NULL,
	`motivo_bloqueo` text,
	`notas` text,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clientes_nro_socio_unq` ON `clientes` (`nro_socio`);--> statement-breakpoint
CREATE INDEX `clientes_referido_idx` ON `clientes` (`referido_por_cliente_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `clientes_ci_unq` ON `clientes` (`ci`,`ci_extension`);--> statement-breakpoint
CREATE INDEX `clientes_apellido_idx` ON `clientes` (`apellido`,`nombre`);--> statement-breakpoint
CREATE TABLE `ingresos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`membresia_id` integer,
	`fecha_hora` integer DEFAULT (unixepoch()) NOT NULL,
	`fecha` text NOT NULL,
	`resultado` text NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`membresia_id`) REFERENCES `membresias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ingresos_cliente_idx` ON `ingresos` (`cliente_id`,`fecha`);--> statement-breakpoint
CREATE INDEX `ingresos_fecha_idx` ON `ingresos` (`fecha`);--> statement-breakpoint
CREATE TABLE `membresias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`plan_id` integer NOT NULL,
	`fecha_inicio` text NOT NULL,
	`fecha_fin` text NOT NULL,
	`estado` text DEFAULT 'vigente' NOT NULL,
	`precio_centavos` integer NOT NULL,
	`plan_precio_id` integer,
	`creado_por` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `planes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_precio_id`) REFERENCES `plan_precios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `membresias_cliente_fin_idx` ON `membresias` (`cliente_id`,`fecha_fin`);--> statement-breakpoint
CREATE INDEX `membresias_fin_idx` ON `membresias` (`fecha_fin`);--> statement-breakpoint
CREATE TABLE `pagos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`membresia_id` integer,
	`monto_centavos` integer NOT NULL,
	`fecha_pago` text NOT NULL,
	`metodo` text DEFAULT 'efectivo' NOT NULL,
	`registrado_por` integer,
	`nota` text,
	`anulado` integer DEFAULT false NOT NULL,
	`motivo_anulacion` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`membresia_id`) REFERENCES `membresias`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registrado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pagos_cliente_idx` ON `pagos` (`cliente_id`,`fecha_pago`);--> statement-breakpoint
CREATE INDEX `pagos_fecha_idx` ON `pagos` (`fecha_pago`);--> statement-breakpoint
CREATE TABLE `plan_precios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`precio_centavos` integer NOT NULL,
	`vigente_desde` text NOT NULL,
	`vigente_hasta` text,
	`es_promocion` integer DEFAULT false NOT NULL,
	`etiqueta` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `planes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plan_precios_plan_idx` ON `plan_precios` (`plan_id`,`vigente_desde`);--> statement-breakpoint
CREATE TABLE `planes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`dias_duracion` integer NOT NULL,
	`es_pase_diario` integer DEFAULT false NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`activo` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario` text NOT NULL,
	`nombre` text NOT NULL,
	`password_hash` text NOT NULL,
	`rol` text DEFAULT 'recepcion' NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_usuario_unq` ON `usuarios` (`usuario`);--> statement-breakpoint
CREATE TABLE `visitas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`ci` text,
	`telefono` text,
	`fecha` text NOT NULL,
	`fecha_hora` integer DEFAULT (unixepoch()) NOT NULL,
	`motivo` text DEFAULT 'cortesia' NOT NULL,
	`invitado_por_cliente_id` integer,
	`convertido_a_cliente_id` integer,
	`registrado_por` integer,
	`nota` text,
	FOREIGN KEY (`invitado_por_cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`convertido_a_cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registrado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `visitas_fecha_idx` ON `visitas` (`fecha`);