-- Como a lista de textos estava quando a pessoa saiu dela.
--
-- Quem trabalha numa pasta passa o dia voltando a ela, e a tela recomeçava
-- sempre na primeira em ordem alfabética, com todas as situações — duas
-- escolhas a refazer a cada visita. É preferência de quem usa, não estado da
-- sessão, então vive no usuário, como já acontece com a última organização.
--
-- Nulo em `ultima_pasta_id` é "nunca escolheu". Nulo em
-- `ultimo_status_de_texto` é "todas as situações", que é também o padrão da
-- tela: os dois casos caem no mesmo lugar, e por isso não é preciso um valor
-- separado para "todas" dentro do enum.
--
-- `ON DELETE SET NULL`: apagar uma pasta não pode impedir alguém de abrir a
-- lista de textos.

ALTER TABLE "users" ADD COLUMN "ultima_pasta_id" UUID;
ALTER TABLE "users" ADD COLUMN "ultimo_status_de_texto" "StatusTexto";

ALTER TABLE "users"
  ADD CONSTRAINT "users_ultima_pasta_id_fkey"
  FOREIGN KEY ("ultima_pasta_id") REFERENCES "folders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
