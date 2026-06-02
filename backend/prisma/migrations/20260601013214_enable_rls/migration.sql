-- Habilitar y forzar Row Level Security (RLS) en cada tabla
ALTER TABLE "Usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Usuario" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Property" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Inquilino" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Inquilino" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Servicio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Servicio" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;

-- Crear políticas de aislamiento de tenant para cada tabla
-- Si 'app.current_tenant_id' no está definido (o está vacío), permitimos la operación (p. ej. para migraciones, seed, login, registro).
-- Si está definido, se aísla el acceso al tenant correspondiente.

CREATE POLICY usuario_tenant_isolation ON "Usuario"
FOR ALL
USING (
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
  OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::integer
);

CREATE POLICY property_tenant_isolation ON "Property"
FOR ALL
USING (
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
  OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::integer
);

CREATE POLICY room_tenant_isolation ON "Room"
FOR ALL
USING (
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
  OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::integer
);

CREATE POLICY inquilino_tenant_isolation ON "Inquilino"
FOR ALL
USING (
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
  OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::integer
);

CREATE POLICY servicio_tenant_isolation ON "Servicio"
FOR ALL
USING (
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
  OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::integer
);

CREATE POLICY payment_tenant_isolation ON "Payment"
FOR ALL
USING (
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
  OR "tenant_ref_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::integer
);