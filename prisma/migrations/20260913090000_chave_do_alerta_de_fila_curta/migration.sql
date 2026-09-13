-- Liga/desliga do alerta de fila curta, por pasta.
--
-- Até aqui o desligamento era `alertar_abaixo_de = 0`, o que misturava duas
-- coisas num campo só: quem silenciava a pasta perdia o número configurado e
-- precisava lembrá-lo para voltar atrás. A chave passa a ser o único jeito de
-- desligar, e o número volta a significar apenas "abaixo de quantos".
--
-- Quem estava com zero é migrado para desligado com o número no padrão — a
-- intenção era silêncio, e é ela que se preserva.

ALTER TABLE "folders"
  ADD COLUMN "alerta_de_fila_curta_ativo" BOOLEAN NOT NULL DEFAULT true;

UPDATE "folders"
SET "alerta_de_fila_curta_ativo" = false,
    "alertar_abaixo_de" = 5
WHERE "alertar_abaixo_de" = 0;
