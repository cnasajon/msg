-- Login passa a ser por nome de usuário; o e-mail vira opcional.
--
-- Quem já existe ganha um username derivado do e-mail: a parte antes do @, em
-- minúsculas, com o que não for letra, número, ponto, hífen ou sublinhado
-- virando ponto. Assim ninguém fica trancado do lado de fora depois do deploy —
-- quem entrava com "ana.silva@oa12.org" passa a entrar com "ana.silva".

ALTER TABLE "users" ADD COLUMN "username" TEXT;

UPDATE "users"
SET "username" = NULLIF(
  regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9._-]', '.', 'g'),
  ''
);

-- e-mail do qual não sobrou nada aproveitável
UPDATE "users" SET "username" = 'usuario' WHERE "username" IS NULL;

-- o mínimo de 3 caracteres que a aplicação exige
UPDATE "users" SET "username" = rpad("username", 3, '.') WHERE length("username") < 3;

-- Colisões (dois e-mails com a mesma parte antes do @, em domínios diferentes)
-- recebem sufixo numérico pela ordem de criação: quem entrou primeiro fica com
-- o nome limpo. O laço procura o primeiro sufixo livre em vez de somar direto,
-- para não esbarrar num username que já exista com aquele número.
DO $$
DECLARE
  repetido RECORD;
  candidato TEXT;
  sufixo INT;
BEGIN
  FOR repetido IN
    SELECT "id", "username"
    FROM (
      SELECT
        "id",
        "username",
        ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "criado_em", "id") AS posicao
      FROM "users"
    ) ordenados
    WHERE posicao > 1
  LOOP
    sufixo := 2;
    LOOP
      candidato := repetido."username" || sufixo::text;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "users" WHERE "username" = candidato);
      sufixo := sufixo + 1;
    END LOOP;
    UPDATE "users" SET "username" = candidato WHERE "id" = repetido."id";
  END LOOP;
END $$;

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- O e-mail deixa de ser obrigatório. O índice único continua, e o Postgres não
-- considera dois nulos iguais, então várias contas podem ficar sem e-mail.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
