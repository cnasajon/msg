/**
 * Cria o primeiro superadmin — o único usuário que não é criado por outro.
 *
 * Uso:
 *   npm run criar-superadmin -- "Nome da Pessoa" usuario [pessoa@exemplo.org]
 *
 * O e-mail é opcional: a entrada é pelo nome de usuário.
 *
 * A senha provisória é gerada aqui e mostrada uma única vez. Não é lida de
 * variável de ambiente nem de argumento: senha em linha de comando fica no
 * histórico do shell.
 */
import { PrismaClient } from '@prisma/client';
import { gerarHashDeSenha, gerarSenhaProvisoria } from '../src/lib/senha';
import { normalizarUsername, problemaNoUsername } from '../src/lib/usuario';
import { fraseNoIdioma } from '../src/lib/mensagens';

const prisma = new PrismaClient();

async function principal() {
  const [nome, usernameBruto, email] = process.argv.slice(2);

  if (!nome || !usernameBruto) {
    console.error('Uso: npm run criar-superadmin -- "Nome da Pessoa" usuario [pessoa@exemplo.org]');
    process.exit(1);
  }

  const username = normalizarUsername(usernameBruto);
  const problema = problemaNoUsername(username);
  if (problema) {
    console.error(fraseNoIdioma(problema, 'pt'));
    process.exit(1);
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`E-mail inválido: ${email}`);
    process.exit(1);
  }

  if (await prisma.user.findUnique({ where: { username } })) {
    console.error(`Já existe um usuário com o nome ${username}.`);
    process.exit(1);
  }
  if (email && (await prisma.user.findUnique({ where: { email: email.toLowerCase() } }))) {
    console.error(`Já existe um usuário com o e-mail ${email}.`);
    process.exit(1);
  }

  const senha = gerarSenhaProvisoria();
  const criado = await prisma.user.create({
    data: {
      nome,
      username,
      email: email ? email.toLowerCase() : null,
      perfil: 'superadmin',
      senhaHash: await gerarHashDeSenha(senha),
      senhaProvisoria: true,
    },
  });

  console.log('');
  console.log('  Superadmin criado.');
  console.log(`  Usuário .........: ${criado.username}`);
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
