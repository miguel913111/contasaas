import { prisma } from '../src/lib/prisma';

async function test() {
  console.log('=== TESTE DE CONEXAO PRISMA ===\n');
  
  await prisma.$queryRaw`SELECT 1`;
  console.log('✅ Conexao DB: OK');
  
  const userCount = await prisma.user.count();
  const companyCount = await prisma.company.count();
  const invoiceCount = await prisma.invoice.count();
  
  console.log('✅ Users:', userCount);
  console.log('✅ Companies:', companyCount);
  console.log('✅ Invoices:', invoiceCount);
  
  const users = await prisma.user.findMany({ select: { email: true, role: true, name: true } });
  console.log('\n=== UTILIZADORES ===');
  users.forEach(u => console.log('  -', u.email, '|', u.role, '|', u.name));
  
  const companies = await prisma.company.findMany({ select: { name: true, nif: true } });
  console.log('\n=== EMPRESAS ===');
  companies.forEach(c => console.log('  -', c.name, '| NIF:', c.nif));
  
  const dbStart = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  console.log('\n✅ Latencia DB:', Date.now() - dbStart, 'ms');
  
  console.log('\n🎉 TUDO FUNCIONA!');
}

test()
  .catch(e => { console.error('❌ ERRO:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
