/**
 * Cria o primeiro superadmin — o único usuário que não é criado por outro.
 *
 * Uso:
 *   npm run criar-superadmin -- "Nome da Pessoa" pessoa@exemplo.org
 *
 * A senha provisória é gerada aqui e mostrada uma única vez. Não é lida de
 * variável de ambiente nem de argumento: senha em linha de comando fica no
 * histórico do shell.
 */
import { PrismaClient } from '@prisma/client';
import { gerarHashDeSenha, gerarSenhaProvisoria } from '../src/lib/senha';

const prisma = new PrismaClient();

async function principal() {
  const [nome, email] = process.argv.slice(2);

  if (!nome || !email) {
    console.error('Uso: npm run criar-superadmin -- "Nome da Pessoa" pessoa@exemplo.org');
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`E-mail inválido: ${email}`);
    process.exit(1);
  }

  const existente = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existente) {
    console.error(`Já existe um usuário com o e-mail ${email}.`);
    process.exit(1);
  }

  const senha = gerarSenhaProvisoria();
  const criado = await prisma.user.create({
    data: {
      nome,
      email: email.toLowerCase(),
      perfil: 'superadmin',
      organizationId: null,
      senhaHash: await gerarHashDeSenha(senha),
      senhaProvisoria: true,
    },
  });

  console.log('');
  console.log('  Superadmin criado.');
  console.log(`  E-mail ..........: ${criado.email}`);
  console.log(`  Senha provisória : ${senha}`);
  console.log('');
  console.log('  Anote a senha agora — ela não é guardada em lugar nenhum e não');
  console.log('  será mostrada de novo. A troca é obrigatória no primeiro acesso.');
  console.log('');
}

principal()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
