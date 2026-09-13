-- Limite do alerta de fila curta, por pasta.
--
-- Era fixo em cinco no código. As pastas que já existem ficam com cinco, que é
-- o que valia até agora, então nada muda de comportamento com esta migração.
-- Zero desliga o aviso.

ALTER TABLE "folders"
  ADD COLUMN "alertar_abaixo_de" INTEGER NOT NULL DEFAULT 5;
