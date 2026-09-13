-- Tipo de lista da pasta e o padrão de data dos textos.
--
-- As pastas que já existem continuam como sempre foram: `fila`, o próximo texto
-- pendente na ordem. As colunas de data ficam nulas, que é como se escreve
-- "todos" — em lista por fila elas nem são lidas.

CREATE TYPE "TipoDeLista" AS ENUM ('fila', 'data');

ALTER TABLE "folders"
  ADD COLUMN "tipo_de_lista" "TipoDeLista" NOT NULL DEFAULT 'fila';

ALTER TABLE "texts"
  ADD COLUMN "dia_da_publicacao" INTEGER,
  ADD COLUMN "mes_da_publicacao" INTEGER,
  ADD COLUMN "ano_da_publicacao" INTEGER;

CREATE INDEX "texts_folder_id_mes_da_publicacao_dia_da_publicacao_idx"
  ON "texts"("folder_id", "mes_da_publicacao", "dia_da_publicacao");

-- Slot de uma lista por data em que nenhum texto casava com o dia. Não é erro:
-- o slot existe porque o dia da semana está marcado no agendamento, e não havia
-- nada agendado para aquela data.
ALTER TYPE "StatusPublicacao" ADD VALUE 'sem_texto';
