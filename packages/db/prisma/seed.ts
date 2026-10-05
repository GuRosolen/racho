import { PrismaClient, Currency, GroupRole, SplitType, ExpenseCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando Seeding do Banco de Dados Racho...');

  // Limpar tabelas existentes em ordem reversa de dependência
  await prisma.auditLog.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.itemAssignment.deleteMany();
  await prisma.expenseItem.deleteMany();
  await prisma.expenseReceipt.deleteMany();
  await prisma.expenseSplit.deleteMany();
  await prisma.expensePayer.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('senha123', 10);

  // 1. Criar Usuários de Teste
  const userAna = await prisma.user.create({
    data: {
      name: 'Ana Silva',
      email: 'ana@racho.app',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
  });

  const userBruno = await prisma.user.create({
    data: {
      name: 'Bruno Costa',
      email: 'bruno@racho.app',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
  });

  const userCarla = await prisma.user.create({
    data: {
      name: 'Carla Dias',
      email: 'carla@racho.app',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    },
  });

  const userDiego = await prisma.user.create({
    data: {
      name: 'Diego Lima',
      email: 'diego@racho.app',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
  });

  console.log('✅ 4 Usuários criados.');

  // 2. Criar Grupo
  const groupFloripa = await prisma.group.create({
    data: {
      name: 'Viagem Floripa 2026',
      description: 'Despesas da casa de praia e passeios',
      currency: Currency.BRL,
      inviteCode: 'FLORIPA2026',
      members: {
        create: [
          { userId: userAna.id, role: GroupRole.OWNER },
          { userId: userBruno.id, role: GroupRole.MEMBER },
          { userId: userCarla.id, role: GroupRole.MEMBER },
          { userId: userDiego.id, role: GroupRole.MEMBER },
        ],
      },
    },
  });

  console.log(`✅ Grupo '${groupFloripa.name}' criado com 4 membros.`);

  // 3. Despesa 1: Aluguel da Casa (R$ 1.200,00 = 120000 centavos) - Pagador: Ana
  await prisma.expense.create({
    data: {
      groupId: groupFloripa.id,
      createdById: userAna.id,
      description: 'Aluguel da Casa de Praia',
      amount: 120000,
      category: ExpenseCategory.ACCOMMODATION,
      splitType: SplitType.EQUAL,
      payers: {
        create: [{ userId: userAna.id, amountPaid: 120000 }],
      },
      splits: {
        create: [
          { userId: userAna.id, shareAmount: 30000 },
          { userId: userBruno.id, shareAmount: 30000 },
          { userId: userCarla.id, shareAmount: 30000 },
          { userId: userDiego.id, shareAmount: 30000 },
        ],
      },
    },
  });

  // 4. Despesa 2: Jantar de Boas Vindas (R$ 300,00 = 30000 centavos) - Múltiplos Pagadores: Bruno (20000) e Carla (10000)
  await prisma.expense.create({
    data: {
      groupId: groupFloripa.id,
      createdById: userBruno.id,
      description: 'Jantar de Boas Vindas no Restaurante',
      amount: 30000,
      category: ExpenseCategory.FOOD_AND_DRINK,
      splitType: SplitType.EQUAL,
      payers: {
        create: [
          { userId: userBruno.id, amountPaid: 20000 },
          { userId: userCarla.id, amountPaid: 10000 },
        ],
      },
      splits: {
        create: [
          { userId: userAna.id, shareAmount: 7500 },
          { userId: userBruno.id, shareAmount: 7500 },
          { userId: userCarla.id, shareAmount: 7500 },
          { userId: userDiego.id, shareAmount: 7500 },
        ],
      },
    },
  });

  console.log('✅ Despesas de teste criadas.');
  console.log('🎉 Seeding concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
