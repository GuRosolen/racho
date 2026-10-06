import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ExpenseService } from './expense.service';
import { db } from '@racho/db';
import { updateExpenseSchema } from '@racho/shared';

describe('ExpenseService - Edição Restrita ao Criador com Bloqueio Otimista (OCC)', () => {
  const expenseService = new ExpenseService();

  it('UC-EDIT-01: Edição bem-sucedida pelo autor original atualizando participantes e valores (version = 1 -> 2)', async () => {
    // Setup: Criar usuários e grupo
    const user1 = await db.user.create({
      data: {
        email: `author_${Date.now()}@racho.test`,
        name: 'Autor Original',
        passwordHash: 'hash',
      },
    });

    const user2 = await db.user.create({
      data: {
        email: `member_${Date.now()}@racho.test`,
        name: 'Membro Grupo',
        passwordHash: 'hash',
      },
    });

    const group = await db.group.create({
      data: {
        name: 'Grupo Edição Test',
        members: {
          create: [
            { userId: user1.id, role: 'OWNER' },
            { userId: user2.id, role: 'MEMBER' },
          ],
        },
      },
    });

    // Criar despesa inicial de R$ 50,00 (5000 centavos)
    const initialExpense = await expenseService.createExpense(user1.id, {
      groupId: group.id,
      description: 'Jantar Inicial',
      amount: 5000,
      splitType: 'EQUAL',
      payers: [{ userId: user1.id, amountPaid: 5000 }],
    });

    assert.strictEqual(initialExpense.version, 1);
    assert.strictEqual(initialExpense.createdById, user1.id);
    assert.strictEqual(initialExpense.paidById, user1.id);

    // Executar edição pelo autor original com novo amount = 6000 (R$ 60,00)
    const updated = await expenseService.updateExpense(user1.id, group.id, initialExpense.id, {
      version: 1,
      description: 'Jantar Editado',
      amount: 6000,
      splitType: 'EQUAL',
      payers: [{ userId: user1.id, amountPaid: 6000 }],
    });

    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.description, 'Jantar Editado');
    assert.strictEqual(updated.amount, 6000);
    assert.strictEqual(updated.createdById, user1.id);
    assert.strictEqual(updated.paidById, user1.id);
  });

  it('UC-EDIT-02: Rejeição com erro 403 Forbidden quando outro membro do grupo tenta enviar a edição', async () => {
    const user1 = await db.user.create({
      data: {
        email: `author2_${Date.now()}@racho.test`,
        name: 'Autor Real',
        passwordHash: 'hash',
      },
    });

    const user2 = await db.user.create({
      data: {
        email: `imposter_${Date.now()}@racho.test`,
        name: 'Outro Membro',
        passwordHash: 'hash',
      },
    });

    const group = await db.group.create({
      data: {
        name: 'Grupo 403 Test',
        members: {
          create: [
            { userId: user1.id, role: 'OWNER' },
            { userId: user2.id, role: 'MEMBER' },
          ],
        },
      },
    });

    const expense = await expenseService.createExpense(user1.id, {
      groupId: group.id,
      description: 'Despesa Autor 1',
      amount: 4000,
      splitType: 'EQUAL',
      payers: [{ userId: user1.id, amountPaid: 4000 }],
    });

    try {
      await expenseService.updateExpense(user2.id, group.id, expense.id, {
        version: 1,
        description: 'Tentativa de Fraude',
        amount: 4000,
        splitType: 'EQUAL',
        payers: [{ userId: user2.id, amountPaid: 4000 }],
      });
      assert.fail('Deveria ter lançado erro 403');
    } catch (err: any) {
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.message, 'Apenas o criador da despesa possui permissão para editá-la');
    }
  });

  it('UC-EDIT-03: Rejeição com erro 409 Conflict quando o payload traz uma versão defasada da despesa', async () => {
    const user1 = await db.user.create({
      data: {
        email: `author3_${Date.now()}@racho.test`,
        name: 'Autor Versão',
        passwordHash: 'hash',
      },
    });

    const group = await db.group.create({
      data: {
        name: 'Grupo 409 Test',
        members: {
          create: [{ userId: user1.id, role: 'OWNER' }],
        },
      },
    });

    const expense = await expenseService.createExpense(user1.id, {
      groupId: group.id,
      description: 'Versao Inicial',
      amount: 3000,
      splitType: 'EQUAL',
      payers: [{ userId: user1.id, amountPaid: 3000 }],
    });

    // Primeira edição legítima incrementa version para 2
    await expenseService.updateExpense(user1.id, group.id, expense.id, {
      version: 1,
      description: 'Primeira Edição',
      amount: 3000,
      splitType: 'EQUAL',
      payers: [{ userId: user1.id, amountPaid: 3000 }],
    });

    // Segunda edição utilizando a versão antiga version = 1 (defasada)
    try {
      await expenseService.updateExpense(user1.id, group.id, expense.id, {
        version: 1,
        description: 'Edição Defasada',
        amount: 3000,
        splitType: 'EQUAL',
        payers: [{ userId: user1.id, amountPaid: 3000 }],
      });
      assert.fail('Deveria ter lançado erro 409');
    } catch (err: any) {
      assert.strictEqual(err.statusCode, 409);
      assert.strictEqual(
        err.message,
        'A despesa foi modificada por outro usuário. Recarregue os dados antes de salvar.'
      );
    }
  });

  it('UC-EDIT-04: Rejeição no Zod Schema caso a soma dos novos splits não bata com o total editado', () => {
    const invalidPayload = {
      version: 1,
      description: 'Despesa Invalida',
      amount: 10000,
      taxAmount: 0,
      splitType: 'ITEMIZED',
      payers: [{ userId: '11111111-1111-1111-1111-111111111111', amountPaid: 10000 }],
      items: [
        {
          name: 'Item 1',
          unitPrice: 4000,
          quantity: 1,
          totalPrice: 4000,
          assignedUserIds: ['11111111-1111-1111-1111-111111111111'],
        },
      ],
    };

    const parseResult = updateExpenseSchema.safeParse(invalidPayload);
    assert.strictEqual(parseResult.success, false);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      assert.strictEqual(
        issue.message,
        'No modo itemizado, a soma dos itens + taxas deve ser exatamente igual ao valor total da despesa'
      );
    }
  });
});
