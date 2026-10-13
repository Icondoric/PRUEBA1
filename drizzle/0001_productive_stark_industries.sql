CREATE TABLE `sesiones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`usuario_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ultimo_uso` integer NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sesiones_token_unq` ON `sesiones` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sesiones_usuario_idx` ON `sesiones` (`usuario_id`);--> statement-breakpoint
CREATE TABLE `usuario_permisos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`permiso` text NOT NULL,
	`otorgado_por` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`otorgado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_permisos_unq` ON `usuario_permisos` (`usuario_id`,`permiso`);--> statement-breakpoint
ALTER TABLE `pagos` ADD `anulado_por` integer REFERENCES usuarios(id);--> statement-breakpoint
ALTER TABLE `pagos` ADD `anulado_en` integer;