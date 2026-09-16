-- Publicação marcada à mão, depois do fato.
--
-- A tela do texto passa a permitir informar ou limpar a data de publicação,
-- para o caso de a publicação ter acontecido fora daqui — alguém postou no
-- grupo por conta própria, ou o registro nasceu torto numa importação.
--
-- A origem é separada de `importacao` por dois motivos: o histórico precisa
-- dizer de onde a linha veio, e limpar a data tem de apagar só estas linhas,
-- nunca uma publicação que de fato saiu pelo dispatcher ou pelo "publicar
-- agora". O histórico sobreviver à edição é ponto não negociável.

ALTER TYPE "OrigemPublicacao" ADD VALUE 'retroativa';
