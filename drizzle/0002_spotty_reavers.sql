ALTER TABLE `clientes` ADD `bloqueado_por` integer REFERENCES usuarios(id);--> statement-breakpoint
ALTER TABLE `clientes` ADD `bloqueado_en` integer;