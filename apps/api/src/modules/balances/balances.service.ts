import { db, Currency } from '@racho/db';
import { GroupBalancesResponse, SimplifiedDebt } from '@racho/shared';

export class BalancesService {
  async getGroupBalances(groupId: string, userId: string): Promise<GroupBalancesResponse> {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!membership) {
      throw new Error('Acesso negado aos saldos do grupo');
    }

    const group = await db.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!group) {
      throw new Error('Grupo não encontrado');
    }

    // 1. Obter todos os pagamentos e divisões de despesas do grupo
    const expenses = await db.expense.findMany({
      where: { groupId },
      include: {
        payers: true,
        splits: true,
      },
    });

    // 2. Obter liquidações confirmadas para abate de saldo
    const confirmedSettlements = await db.settlement.findMany({
      where: {
        groupId,
        status: 'CONFIRMED',
      },
    });

    // 2b. Obter liquidações pendentes / aguardando confirmação
    const activeSettlements = await db.settlement.findMany({
      where: {
        groupId,
        status: { in: ['AWAITING_CONFIRMATION', 'PENDING', 'REJECTED'] },
      },
    });

    // 3. Inicializar mapa de saldos por membro do grupo
    const balanceMap = new Map<string, { userName: string; netBalance: number }>();
    for (const m of group.members) {
      balanceMap.set(m.userId, { userName: m.user.name, netBalance: 0 });
    }

    // Processar despesas: Pagador recebe crédito (+), Participante da divisão recebe débito (-)
    for (const expense of expenses) {
      for (const payer of expense.payers) {
        const current = balanceMap.get(payer.userId);
        if (current) {
          current.netBalance += payer.amountPaid;
        }
      }
      for (const split of expense.splits) {
        const current = balanceMap.get(split.userId);
        if (current) {
          current.netBalance -= split.shareAmount;
        }
      }
    }

    // Processar APENAS liquidações CONFIRMADAS no cálculo de saldo líquido:
    for (const settlement of confirmedSettlements) {
      const payerEntry = balanceMap.get(settlement.payerId);
      if (payerEntry) {
        payerEntry.netBalance += settlement.amount;
      }
      const receiverEntry = balanceMap.get(settlement.receiverId);
      if (receiverEntry) {
        receiverEntry.netBalance -= settlement.amount;
      }
    }

    const balances = Array.from(balanceMap.entries()).map(([uId, data]) => ({
      userId: uId,
      userName: data.userName,
      netBalance: data.netBalance,
    }));

    // 4. Executar o Algoritmo de Simplificação de Dívidas (Graph Min-Flow - UC03)
    const simplifiedDebts = this.simplifyDebts(balances, group.currency, activeSettlements);

    return {
      groupId,
      currency: group.currency,
      balances,
      simplifiedDebts,
    };
  }

  /**
   * Algoritmo de Fila de Prioridade Gulosa O(N log N) para simplificação de grafo de dívidas.
   */
  private simplifyDebts(
    balances: { userId: string; userName: string; netBalance: number }[],
    currency: Currency,
    activeSettlements: any[] = []
  ): SimplifiedDebt[] {
    const debtors: { userId: string; userName: string; netBalance: number }[] = [];
    const creditors: { userId: string; userName: string; netBalance: number }[] = [];

    for (const b of balances) {
      if (b.netBalance < 0) {
        debtors.push({ ...b, netBalance: -b.netBalance }); // Armazena valor absoluto do débito
      } else if (b.netBalance > 0) {
        creditors.push({ ...b });
      }
    }

    // Ordenar do maior para o menor valor
    debtors.sort((a, b) => b.netBalance - a.netBalance);
    creditors.sort((a, b) => b.netBalance - a.netBalance);

    const transactions: SimplifiedDebt[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const settledAmount = Math.min(debtor.netBalance, creditor.netBalance);

      if (settledAmount > 0) {
        // Buscar se existe um acerto em andamento entre este devedor e credor
        const matchingSettlement = activeSettlements.find(
          (s) => s.payerId === debtor.userId && s.receiverId === creditor.userId
        );

        transactions.push({
          fromUserId: debtor.userId,
          fromUserName: debtor.userName,
          toUserId: creditor.userId,
          toUserName: creditor.userName,
          amount: settledAmount,
          currency,
          settlementId: matchingSettlement ? matchingSettlement.id : undefined,
          status: matchingSettlement ? matchingSettlement.status : 'PENDING',
        });

        debtor.netBalance -= settledAmount;
        creditor.netBalance -= settledAmount;
      }

      if (debtor.netBalance === 0) i++;
      if (creditor.netBalance === 0) j++;
    }

    return transactions;
  }
}
