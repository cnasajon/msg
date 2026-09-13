-- Última organização que o superadmin escolheu operar.
--
-- A organização ativa vivia só na sessão, e sessão morre a cada login — e
-- também a cada troca de domínio, porque o cookie é por domínio. Resultado: o
-- superadmin recomeçava na tela de escolha toda vez. A escolha é uma
-- preferência da pessoa, não um estado daquela sessão, então passa a viver no
-- usuário.
--
-- `ON DELETE SET NULL`: apagar uma organização não pode derrubar o login de
-- quem a tinha escolhido por último.

ALTER TABLE "users" ADD COLUMN "ultima_organizacao_id" UUID;

ALTER TABLE "users"
  ADD CONSTRAINT "users_ultima_organizacao_id_fkey"
  FOREIGN KEY ("ultima_organizacao_id") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
