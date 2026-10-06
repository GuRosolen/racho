import { db, SplitType, AuditAction } from '@racho/db';
import { CreateExpenseInput, distributeEqualCents, distributeProRataCents } from '@racho/shared';

export class ExpenseService {
  async createExpense(userId: string, input: CreateExpenseInput) {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: input.groupId, userId } },
    });

    if (!membership) {
      throw new Error('Você não pertence a este grupo para registrar despesas');
    }

    const groupMembers = await db.groupMember.findMany({
      where: { groupId: input.groupId },
      select: { userId: true },
    });
    const groupMemberIdsSet = new Set(groupMembers.map((m) => m.userId));

    // Validar pertencimento de pagadores
    for (const p of input.payers) {
      if (!groupMemberIdsSet.has(p.userId)) {
        throw new Error(`O usuário ${p.userId} não pertence a este grupo de despesas`);
      }
    }

    let splitsData: { userId: string; shareAmount: number }[] = [];
    let itemsToCreateData: {
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      assignments: { userId: string; assignedAmount: number }[];
    }[] = [];

    if (input.splitType === 'ITEMIZED') {
      if (!input.items || input.items.length === 0) {
        throw new Error('Uma despesa itemizada deve conter ao menos 1 item');
      }

      const totalItemsPrice = input.items.reduce((acc, item) => acc + item.totalPrice, 0);
      const expectedTotal = totalItemsPrice + (input.taxAmount || 0);

      if (expectedTotal !== input.amount) {
        throw new Error(
          `A soma dos itens + taxas (${expectedTotal} centavos) diverge do valor total da despesa (${input.amount} centavos)`
        );
      }

      const userGrossConsumption = new Map<string, number>();

      for (const item of input.items) {
        if (!item.assignedUserIds || item.assignedUserIds.length === 0) {
          throw new Error(`O item '${item.name}' deve ter ao menos 1 participante associado`);
        }

        // Validar pertencimento dos membros do item ao grupo
        for (const uId of item.assignedUserIds) {
          if (!groupMemberIdsSet.has(uId)) {
            throw new Error(`O usuário ${uId} não pertence a este grupo de despesas`);
          }
        }

        // Distribuir o valor do item em centavos entre os consumidores do item
        const itemSplitMap = distributeEqualCents(item.totalPrice, item.assignedUserIds);
        const itemAssignmentsData: { userId: string; assignedAmount: number }[] = [];

        itemSplitMap.forEach((share, uId) => {
          itemAssignmentsData.push({ userId: uId, assignedAmount: share });
          const currentGross = userGrossConsumption.get(uId) || 0;
          userGrossConsumption.set(uId, currentGross + share);
        });

        itemsToCreateData.push({
          name: item.name,
          quantity: item.quantity ?? 1,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          assignments: itemAssignmentsData,
        });
      }

      // Distribuir taxa / gorjeta pro-rata entre os membros que consumiram itens
      const taxAmount = input.taxAmount || 0;
      let taxDistributionMap = new Map<string, number>();
      if (taxAmount > 0 && userGrossConsumption.size > 0) {
        taxDistributionMap = distributeProRataCents(taxAmount, userGrossConsumption);
      }

      // Consolidar cotas finais por usuário (Consumo + Taxa)
      userGrossConsumption.forEach((grossShare, uId) => {
        const taxShare = taxDistributionMap.get(uId) || 0;
        splitsData.push({
          userId: uId,
          shareAmount: grossShare + taxShare,
        });
      });
    } else if (input.splitType === SplitType.EQUAL) {
      // Suporte a Subconjunto de Membros
      const targetMemberIds =
        input.memberIds && input.memberIds.length > 0
          ? input.memberIds
          : Array.from(groupMemberIdsSet);

      // Validar pertencimento do subconjunto
      for (const uId of targetMemberIds) {
        if (!groupMemberIdsSet.has(uId)) {
          throw new Error(`O usuário ${uId} não pertence a este grupo de despesas`);
        }
      }

      const equalMap = distributeEqualCents(input.amount, targetMemberIds);
      splitsData = Array.from(equalMap.entries()).map(([uId, share]) => ({
        userId: uId,
        shareAmount: share,
      }));
    } else if (input.splits && input.splits.length > 0) {
      for (const s of input.splits) {
        if (!groupMemberIdsSet.has(s.userId)) {
          throw new Error(`O usuário ${s.userId} não pertence a este grupo de despesas`);
        }
      }

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
          taxAmount: input.taxAmount || 0,
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
          items: {
            create: itemsToCreateData.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              assignments: {
                create: item.assignments.map((a) => ({
                  userId: a.userId,
                  assignedAmount: a.assignedAmount,
                })),
              },
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
          items: {
            include: {
              assignments: {
                include: { user: { select: { id: true, name: true } } },
              },
            },
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
          payload: JSON.stringify({
            description: expense.description,
            amount: expense.amount,
            splitType: expense.splitType,
          }),
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
