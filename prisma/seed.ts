/**
 * Seed da base de dados para desenvolvimento
 * 
 * Cria:
 * - 1 utilizador contabilista (teste)
 * - 1 utilizador ENI (teste)
 * - 1 empresa de teste
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_PASSWORD = 'teste123';
async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('Iniciando seed...\n');

  // Cria contabilista de teste
  const accountant = await prisma.user.upsert({
    where: { email: 'contabilista@teste.pt' },
    update: { passwordHash: await hashPassword(TEST_PASSWORD) },
    create: {
      email: 'contabilista@teste.pt',
      name: 'Ana Silva (Contabilista)',
      role: 'ACCOUNTANT',
      passwordHash: await hashPassword(TEST_PASSWORD),
    },
  });
  console.log('Contabilista criada:', accountant.email);

  // Cria ENI de teste
  const eni = await prisma.user.upsert({
    where: { email: 'eni@teste.pt' },
    update: { passwordHash: await hashPassword(TEST_PASSWORD) },
    create: {
      email: 'eni@teste.pt',
      name: 'Jose Ferreira (ENI)',
      role: 'SELF_SERVICE',
      passwordHash: await hashPassword(TEST_PASSWORD),
    },
  });
  console.log('ENI criado:', eni.email);

  // Cria empresa do ENI
  const company = await prisma.company.upsert({
    where: { nif: '123456789' },
    update: {},
    create: {
      name: 'Construcoes Jose Ferreira, UNIPESSOAL LDA',
      nif: '123456789',
      address: 'Rua das Flores, 45',
      city: 'Lisboa',
      postalCode: '1000-001',
      phone: '+351912345678',
      email: 'jose@construcoes.pt',
      activityCode: '4120',
      ownerId: eni.id,
      accountantId: accountant.id,
    },
  });
  console.log('Empresa criada:', company.name, `NIF: ${company.nif}`);

  console.log('\nSeed concluido com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
