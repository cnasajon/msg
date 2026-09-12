-- CreateEnum
CREATE TYPE "Idioma" AS ENUM ('pt', 'es', 'en');

-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('superadmin', 'admin', 'usuario');

-- CreateEnum
CREATE TYPE "AoEsgotar" AS ENUM ('parar_notificar', 'reiniciar');

-- CreateEnum
CREATE TYPE "StatusTexto" AS ENUM ('pendente', 'publicado', 'erro', 'arquivado');

-- CreateEnum
CREATE TYPE "OrigemPublicacao" AS ENUM ('dispatcher', 'manual', 'importacao');

-- CreateEnum
CREATE TYPE "StatusPublicacao" AS ENUM ('reivindicada', 'enviada', 'erro', 'perdida');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "idioma_padrao" "Idioma" NOT NULL DEFAULT 'pt',
    "timezone_padrao" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "telegram_username" TEXT,
    "senha_hash" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "idioma" "Idioma",
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "senha_provisoria" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_login_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "organization_ativa_id" UUID,
    "ip" TEXT,
    "user_agent" TEXT,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_folders" (
    "user_id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,

    CONSTRAINT "user_folders_pkey" PRIMARY KEY ("user_id","folder_id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "timezone" TEXT NOT NULL,
    "telegram_chat_id" TEXT,
    "telegram_bot_token_cifrado" TEXT,
    "ao_esgotar" "AoEsgotar" NOT NULL DEFAULT 'parar_notificar',
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "texts" (
    "id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "conteudo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "imagem" BYTEA,
    "imagem_mime" TEXT,
    "imagem_bytes" INTEGER,
    "imagem_nome_original" TEXT,
    "status" "StatusTexto" NOT NULL DEFAULT 'pendente',
    "publicado_em" TIMESTAMPTZ(3),
    "arquivado_em" TIMESTAMPTZ(3),
    "erro_mensagem" TEXT,
    "import_id" UUID,
    "hash_conteudo" TEXT NOT NULL,
    "criado_por" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "texts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "hora_local" TEXT NOT NULL,
    "dias_semana" INTEGER[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "text_id" UUID,
    "origem" "OrigemPublicacao" NOT NULL DEFAULT 'dispatcher',
    "data_prevista" DATE NOT NULL,
    "hora_prevista" TIME(0),
    "status" "StatusPublicacao" NOT NULL DEFAULT 'reivindicada',
    "conteudo_publicado" TEXT,
    "tinha_imagem" BOOLEAN NOT NULL DEFAULT false,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "telegram_message_id" TEXT,
    "erro_mensagem" TEXT,
    "reivindicada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviada_em" TIMESTAMPTZ(3),

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "alerts_chat_id" TEXT,
    "google_chat_webhook" TEXT,
    "atualizado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports" (
    "id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "arquivo_nome" TEXT NOT NULL,
    "total_linhas" INTEGER NOT NULL,
    "importadas" INTEGER NOT NULL,
    "duplicadas_ignoradas" INTEGER NOT NULL,
    "importadas_como_historico" INTEGER NOT NULL DEFAULT 0,
    "desfeito_em" TIMESTAMPTZ(3),
    "criado_por" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "user_id" UUID,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT,
    "detalhes" JSONB,
    "ip" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organizations_ativa_idx" ON "organizations"("ativa");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_perfil_idx" ON "users"("organization_id", "perfil");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expira_em_idx" ON "sessions"("expira_em");

-- CreateIndex
CREATE INDEX "user_folders_folder_id_idx" ON "user_folders"("folder_id");

-- CreateIndex
CREATE INDEX "folders_organization_id_ativa_idx" ON "folders"("organization_id", "ativa");

-- CreateIndex
CREATE UNIQUE INDEX "folders_organization_id_nome_key" ON "folders"("organization_id", "nome");

-- CreateIndex
CREATE INDEX "texts_folder_id_status_ordem_idx" ON "texts"("folder_id", "status", "ordem");

-- CreateIndex
CREATE INDEX "texts_import_id_idx" ON "texts"("import_id");

-- CreateIndex
CREATE UNIQUE INDEX "texts_folder_id_hash_conteudo_key" ON "texts"("folder_id", "hash_conteudo");

-- CreateIndex
CREATE INDEX "schedules_folder_id_ativo_idx" ON "schedules"("folder_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_folder_id_hora_local_key" ON "schedules"("folder_id", "hora_local");

-- CreateIndex
CREATE INDEX "publications_folder_id_data_prevista_idx" ON "publications"("folder_id", "data_prevista");

-- CreateIndex
CREATE INDEX "publications_status_idx" ON "publications"("status");

-- CreateIndex
CREATE INDEX "publications_folder_id_origem_idx" ON "publications"("folder_id", "origem");

-- CreateIndex
CREATE UNIQUE INDEX "publications_folder_id_data_prevista_hora_prevista_key" ON "publications"("folder_id", "data_prevista", "hora_prevista");

-- CreateIndex
CREATE INDEX "imports_folder_id_criado_em_idx" ON "imports"("folder_id", "criado_em");

-- CreateIndex
CREATE INDEX "audit_log_organization_id_criado_em_idx" ON "audit_log"("organization_id", "criado_em");

-- CreateIndex
CREATE INDEX "audit_log_entidade_entidade_id_idx" ON "audit_log"("entidade", "entidade_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_folders" ADD CONSTRAINT "user_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_folders" ADD CONSTRAINT "user_folders_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "texts" ADD CONSTRAINT "texts_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "texts" ADD CONSTRAINT "texts_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "texts" ADD CONSTRAINT "texts_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_text_id_fkey" FOREIGN KEY ("text_id") REFERENCES "texts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_atualizado_por_fkey" FOREIGN KEY ("atualizado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
