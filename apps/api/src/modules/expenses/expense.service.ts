import { db, SplitType, AuditAction } from '@racho/db';
import { CreateExpenseInput, distributeEqualCents } from '@racho/shared';

export class ExpenseService {
  async createExpense(userId: string, input: CreateExpenseInput) {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: input.groupId, userId } },
    });

    if (!membership) {
      throw new Error('Você não pertence a este grupo para registrar despesas');
    }

    const members = await db.groupMember.findMany({
      where: { groupId: input.groupId },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);

    let splitsData: { userId: string; shareAmount: number }[] = [];

    if (input.splitType === SplitType.EQUAL) {
      const equalMap = distributeEqualCents(input.amount, memberIds);
      splitsData = Array.from(equalMap.entries()).map(([uId, share]) => ({
        userId: uId,
        shareAmount: share,
      }));
    } else if (input.splits && input.splits.length > 0) {
      splitsData = input.splits.map((s) => ({
        userId: s.userId,
        shareAmount: s.shareAmount,
      }));

      const totalShares = splitsData.reduce((acc, s) => acc + s.shareAmount, 0);
      if (totalShares !== input.amount) {
        throw new Error(
          `A soma das cotas (${totalShares} centavos) não é igual ao valor da despesa (${input.amount} centavos)`
        );
      }
    } else {
      throw new Error('Divisão de despesa inválida');
    }

    const result = await db.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          groupId: input.groupId,
          createdById: userId,
          description: input.description,
          amount: input.amount,
          currency: input.currency || 'BRL',
          category: input.category || 'OTHER',
          splitType: input.splitType || SplitType.EQUAL,
          date: input.date ? new Date(input.date) : new Date(),
          receipt: input.receiptId ? { connect: { id: input.receiptId } } : undefined,
          payers: {
            create: input.payers.map((p) => ({
              userId: p.userId,
              amountPaid: p.amountPaid,
            })),
          },
          splits: {
            create: splitsData.map((s) => ({
              userId: s.userId,
              shareAmount: s.shareAmount,
            })),
          },
        },
        include: {
          payers: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
          splits: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          groupId: input.groupId,
          userId,
          action: AuditAction.CREATE_EXPENSE,
          entityType: 'EXPENSE',
          entityId: expense.id,
          payload: JSON.stringify({ description: expense.description, amount: expense.amount }),
        },
      });

      return expense;
    });

    return result;
  }

  async getGroupExpenses(groupId: string, userId: string) {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!membership) {
      throw new Error('Acesso negado ao histórico do grupo');
    }

    const expenses = await db.expense.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        payers: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        splits: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        receipt: { select: { id: true, imageUrl: true, merchantName: true } },
      },
    });

    return expenses;
  }

  async deleteExpense(expenseId: string, userId: string) {
    const expense = await db.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      throw new Error('Despesa não encontrada');
    }

    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: expense.groupId, userId } },
    });

    if (!membership) {
      throw new Error('Sem permissão para excluir esta despesa');
    }

    await db.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id: expenseId } });

      await tx.auditLog.create({
        data: {
          groupId: expense.groupId,
          userId,
          action: AuditAction.DELETE_EXPENSE,
          entityType: 'EXPENSE',
          entityId: expenseId,
          payload: JSON.stringify({ description: expense.description, amount: expense.amount }),
        },
      });
    });

    return { message: 'Despesa excluída com sucesso' };
  }
}
