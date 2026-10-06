import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { db, GroupRole } from '@racho/db';
import { ExpenseService } from './expense.service';
import { GroupService } from '../groups/group.service';
import bcrypt from 'bcryptjs';

describe('ExpenseService - Subconjunto de Membros & Divisão Itemizada (SDD-DELTA-002)', () => {
  const expenseService = new ExpenseService();
  const groupService = new GroupService();

  let u1Id: string, u2Id: string, u3Id: string, u4Id: string, u5Id: string;
  let nonMemberId: string;
  let testGroupId: string;

  before(async () => {
    const passwordHash = await bcrypt.hash('senha123', 8);

    // Criar 5 usuários pertencentes ao grupo
    const u1 = await db.user.create({ data: { name: 'U1 Teste', email: `u1_${Date.now()}@racho.test`, passwordHash } });
    const u2 = await db.user.create({ data: { name: 'U2 Teste', email: `u2_${Date.now()}@racho.test`, passwordHash } });
    const u3 = await db.user.create({ data: { name: 'U3 Teste', email: `u3_${Date.now()}@racho.test`, passwordHash } });
    const u4 = await db.user.create({ data: { name: 'U4 Teste', email: `u4_${Date.now()}@racho.test`, passwordHash } });
    const u5 = await db.user.create({ data: { name: 'U5 Teste', email: `u5_${Date.now()}@racho.test`, passwordHash } });

    u1Id = u1.id; u2Id = u2.id; u3Id = u3.id; u4Id = u4.id; u5Id = u5.id;

    // Criar usuário não-membro para testes de rejeição
    const nonMember = await db.user.create({ data: { name: 'Estranho', email: `nonmember_${Date.now()}@racho.test`, passwordHash } });
    nonMemberId = nonMember.id;

    // Criar grupo com 5 membros
    const group = await groupService.createGroup(u1Id, {
      name: 'Grupo Teste Avançado',
      description: 'Grupo para testes de divisão itemizada e subconjuntos',
      currency: 'BRL',
    });
    testGroupId = group.id;

    // Adicionar os outros 4 membros ao grupo
    await db.groupMember.createMany({
      data: [
        { groupId: testGroupId, userId: u2Id, role: GroupRole.MEMBER },
        { groupId: testGroupId, userId: u3Id, role: GroupRole.MEMBER },
        { groupId: testGroupId, userId: u4Id, role: GroupRole.MEMBER },
        { groupId: testGroupId, userId: u5Id, role: GroupRole.MEMBER },
      ],
    });
  });

  after(async () => {
    if (testGroupId) await db.group.delete({ where: { id: testGroupId } }).catch(() => {});
    const userIds = [u1Id, u2Id, u3Id, u4Id, u5Id, nonMemberId].filter(Boolean);
    for (const uid of userIds) {
      await db.user.delete({ where: { id: uid } }).catch(() => {});
    }
  });

  it('UC-SUBSET-01: Deve dividir uma despesa EQUAL em subconjunto de 2 dos 5 membros sem incluir os demais', async () => {
    const expense = await expenseService.createExpense(u1Id, {
      groupId: testGroupId,
      description: 'Táxi apenas para U2 e U3',
      amount: 5000, // R$ 50,00
      splitType: 'EQUAL',
      payers: [{ userId: u1Id, amountPaid: 5000 }],
      memberIds: [u2Id, u3Id], // Subconjunto
    });

    assert.strictEqual(expense.amount, 5000);
    assert.strictEqual(expense.splits.length, 2);

    const splitU2 = expense.splits.find((s) => s.userId === u2Id);
    const splitU3 = expense.splits.find((s) => s.userId === u3Id);

    assert.ok(splitU2);
    assert.strictEqual(splitU2.shareAmount, 2500);

    assert.ok(splitU3);
    assert.strictEqual(splitU3.shareAmount, 2500);

    const totalSplits = expense.splits.reduce((acc, s) => acc + s.shareAmount, 0);
    assert.strictEqual(totalSplits, 5000);
  });

  it('UC-ITEMIZED-01: Deve dividir item de R$ 10,00 (1000 centavos) por 3 pessoas sem perder centavos', async () => {
    const expense = await expenseService.createExpense(u1Id, {
      groupId: testGroupId,
      description: 'Entrada compartilhada por U1, U2 e U3',
      amount: 1000, // R$ 10,00
      splitType: 'ITEMIZED',
      taxAmount: 0,
      payers: [{ userId: u1Id, amountPaid: 1000 }],
      items: [
        {
          name: 'Entrada de Batatas',
          quantity: 1,
          unitPrice: 1000,
          totalPrice: 1000,
          assignedUserIds: [u1Id, u2Id, u3Id],
        },
      ],
    });

    assert.strictEqual(expense.splits.length, 3);
    const splitsMap = new Map(expense.splits.map((s) => [s.userId, s.shareAmount]));

    assert.strictEqual(splitsMap.get(u1Id), 334); // Centavo excedente atrelado ao 1º consumidor
    assert.strictEqual(splitsMap.get(u2Id), 333);
    assert.strictEqual(splitsMap.get(u3Id), 333);

    const totalSplits = Array.from(splitsMap.values()).reduce((acc, val) => acc + val, 0);
    assert.strictEqual(totalSplits, 1000);
  });

  it('UC-TAX-01: Deve distribuir taxa/gorjeta de R$ 10,00 pro-rata entre os membros conforme o consumo', async () => {
    // U1 consumiu R$ 30,00 (3000 centavos)
    // U2 consumiu R$ 70,00 (7000 centavos)
    // Gorjeta = R$ 10,00 (1000 centavos) -> Total = R$ 110,00 (11000 centavos)
    const expense = await expenseService.createExpense(u1Id, {
      groupId: testGroupId,
      description: 'Jantar com Gorjeta Pro-Rata',
      amount: 11000,
      taxAmount: 1000,
      splitType: 'ITEMIZED',
      payers: [{ userId: u1Id, amountPaid: 11000 }],
      items: [
        {
          name: 'Prato U1',
          quantity: 1,
          unitPrice: 3000,
          totalPrice: 3000,
          assignedUserIds: [u1Id],
        },
        {
          name: 'Prato U2',
          quantity: 1,
          unitPrice: 7000,
          totalPrice: 7000,
          assignedUserIds: [u2Id],
        },
      ],
    });

    const splitsMap = new Map(expense.splits.map((s) => [s.userId, s.shareAmount]));

    // U1: 3000 consumo + 300 taxa (30%) = 3300 centavos (R$ 33,00)
    assert.strictEqual(splitsMap.get(u1Id), 3300);

    // U2: 7000 consumo + 700 taxa (70%) = 7700 centavos (R$ 77,00)
    assert.strictEqual(splitsMap.get(u2Id), 7700);

    const totalSplits = Array.from(splitsMap.values()).reduce((acc, val) => acc + val, 0);
    assert.strictEqual(totalSplits, 11000);
  });

  it('UC-ERR-01: Deve rejeitar despesa itemizada com divergência entre a soma dos itens + taxas e o valor total', async () => {
    await assert.rejects(
      async () => {
        await expenseService.createExpense(u1Id, {
          groupId: testGroupId,
          description: 'Despesa com erro de cálculo',
          amount: 10000, // Declarou R$ 100,00
          taxAmount: 1000, // Taxa R$ 10,00
          splitType: 'ITEMIZED',
          payers: [{ userId: u1Id, amountPaid: 10000 }],
          items: [
            {
              name: 'Item Incompleto',
              quantity: 1,
              unitPrice: 5000,
              totalPrice: 5000, // Soma = 5000 + 1000 = 6000 != 10000
              assignedUserIds: [u1Id],
            },
          ],
        });
      },
      /diverge do valor total da despesa/
    );
  });

  it('UC-ERR-02: Deve rejeitar inclusão de usuário que não é membro do grupo', async () => {
    await assert.rejects(
      async () => {
        await expenseService.createExpense(u1Id, {
          groupId: testGroupId,
          description: 'Despesa com intruso',
          amount: 5000,
          splitType: 'ITEMIZED',
          payers: [{ userId: u1Id, amountPaid: 5000 }],
          items: [
            {
              name: 'Item Inválido',
              quantity: 1,
              unitPrice: 5000,
              totalPrice: 5000,
              assignedUserIds: [nonMemberId], // Não é membro do grupo
            },
          ],
        });
      },
      /não pertence a este grupo de despesas/
    );
  });
});
