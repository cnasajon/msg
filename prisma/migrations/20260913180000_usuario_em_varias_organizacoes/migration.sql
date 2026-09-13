-- A mesma pessoa passa a poder participar de mais de uma organização.
--
-- O campo único `users.organization_id` dizia "esta pessoa é daqui", e não
-- havia como dizer "é daqui e dali". Vira uma tabela de participação, e a
-- escolha de qual organização se está operando passa a ser da sessão — como já
-- era para o superadmin, agora para todos.
--
-- Ninguém perde acesso: cada pessoa que tinha uma organização ganha exatamente
-- uma linha aqui, com a mesma organização.

CREATE TABLE "user_organizations" (
  "user_id"         UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  CONSTRAINT "user_organizations_pkey" PRIMARY KEY ("user_id", "organization_id")
);

CREATE INDEX "user_organizations_organization_id_idx" ON "user_organizations"("organization_id");

ALTER TABLE "user_organizations"
  ADD CONSTRAINT "user_organizations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_organizations"
  ADD CONSTRAINT "user_organizations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_organizations" ("user_id", "organization_id")
SELECT "id", "organization_id" FROM "users" WHERE "organization_id" IS NOT NULL;

DROP INDEX IF EXISTS "users_organization_id_perfil_idx";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_organization_id_fkey";
ALTER TABLE "users" DROP COLUMN "organization_id";
CREATE INDEX "users_perfil_idx" ON "users"("perfil");
