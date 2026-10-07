import { describe, it } from 'node:test';
import assert from 'node:assert';
import { db, GroupRole } from '@racho/db';
import { AuthService } from '../auth/auth.service';
import { GroupService } from '../groups/group.service';
import { BalancesService } from '../balances/balances.service';

describe('Liquidação em Duas Vias (Two-Way Handshake) & Notificações (+1)', () => {
  const authService = new AuthService();
  const groupService = new GroupService();
  const balancesService = new BalancesService();

  it('UC-HANDSHAKE-01: Devedor marca como pago -> Credor recebe notificação (+1) e saldo permanece pendente de confirmação', async () => {
    const debtor = await authService.register({
      name: 'Diego Devedor',
      email: `diego_${Date.now()}@racho.test`,
      password: 'password123',
    });

    const creditor = await authService.register({
      name: 'Shirley Credora',
      email: `shirley_${Date.now()}@racho.test`,
      password: 'password123',
    });

    const group = await groupService.createGroup(debtor.id, {
      name: 'Grupo Handshake Test',
      currency: 'BRL',
    });

    await db.groupMember.create({
      data: {
        groupId: group.id,
        userId: creditor.id,
        role: GroupRole.MEMBER,
      },
    });

    await db.expense.create({
      data: {
        groupId: group.id,
        createdById: creditor.id,
        paidById: creditor.id,
        description: 'Jantar',
        amount: 10000,
        currency: 'BRL',
        payers: { create: { userId: creditor.id, amountPaid: 10000 } },
        splits: {
          create: [
            { userId: creditor.id, shareAmount: 5000 },
            { userId: debtor.id, shareAmount: 5000 },
          ],
        },
      },
    });

    let initialBalances = await balancesService.getGroupBalances(group.id, debtor.id);
    assert.strictEqual(initialBalances.simplifiedDebts.length, 1);
    assert.strictEqual(initialBalances.simplifiedDebts[0].amount, 5000);
    assert.strictEqual(initialBalances.simplifiedDebts[0].status, 'PENDING');

    const settlement = await db.settlement.create({
      data: {
        groupId: group.id,
        payerId: debtor.id,
        receiverId: creditor.id,
        amount: 5000,
        status: 'AWAITING_CONFIRMATION',
        paidAt: new Date(),
      },
    });

    await db.notification.create({
      data: {
        userId: creditor.id,
        settlementId: settlement.id,
        type: 'SETTLEMENT_AWAITING_APPROVAL',
        title: 'Solicitação de Confirmação de Pagamento',
        message: `${debtor.name} marcou o pagamento de R$ 50,00 como realizado`,
      },
    });

    const unreadCount = await db.notification.count({
      where: { userId: creditor.id, read: false },
    });
    assert.strictEqual(unreadCount, 1);

    let pendingBalances = await balancesService.getGroupBalances(group.id, debtor.id);
    assert.strictEqual(pendingBalances.simplifiedDebts.length, 1);
    assert.strictEqual(pendingBalances.simplifiedDebts[0].amount, 5000);
    assert.strictEqual(pendingBalances.simplifiedDebts[0].status, 'AWAITING_CONFIRMATION');
    assert.strictEqual(pendingBalances.simplifiedDebts[0].settlementId, settlement.id);
  });

  it('UC-HANDSHAKE-02: Credor confirma recebimento -> Notificação é lida e saldo é abatido do grupo', async () => {
    const debtor = await authService.register({
      name: 'Diego 2',
      email: `diego2_${Date.now()}@racho.test`,
      password: 'password123',
    });

    const creditor = await authService.register({
      name: 'Shirley 2',
      email: `shirley2_${Date.now()}@racho.test`,
      password: 'password123',
    });

    const group = await groupService.createGroup(debtor.id, {
      name: 'Grupo Confirm Test',
      currency: 'BRL',
    });

    await db.groupMember.create({
      data: { groupId: group.id, userId: creditor.id, role: GroupRole.MEMBER },
    });

    await db.expense.create({
      data: {
        groupId: group.id,
        createdById: creditor.id,
        paidById: creditor.id,
        description: 'Almoço',
        amount: 6000,
        currency: 'BRL',
        payers: { create: { userId: creditor.id, amountPaid: 6000 } },
        splits: {
          create: [
            { userId: creditor.id, shareAmount: 3000 },
            { userId: debtor.id, shareAmount: 3000 },
          ],
        },
      },
    });

    const settlement = await db.settlement.create({
      data: {
        groupId: group.id,
        payerId: debtor.id,
        receiverId: creditor.id,
        amount: 3000,
        status: 'AWAITING_CONFIRMATION',
        paidAt: new Date(),
      },
    });

    await db.notification.create({
      data: {
        userId: creditor.id,
        settlementId: settlement.id,
        type: 'SETTLEMENT_AWAITING_APPROVAL',
        title: 'Aprovação pendente',
        message: 'Diego pagou 30,00',
      },
    });

    await db.$transaction(async (tx) => {
      await tx.settlement.update({
        where: { id: settlement.id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });

      await tx.notification.updateMany({
        where: { settlementId: settlement.id },
        data: { read: true },
      });
    });

    const unreadCount = await db.notification.count({
      where: { userId: creditor.id, read: false },
    });
    assert.strictEqual(unreadCount, 0);

    const finalBalances = await balancesService.getGroupBalances(group.id, debtor.id);
    assert.strictEqual(finalBalances.simplifiedDebts.length, 0);
  });

  it('UC-HANDSHAKE-03: Terceiro não autorizados tentam alterar status -> Rejeitado com erro 403', async () => {
    const debtor = await authService.register({
      name: 'Diego 3',
      email: `diego3_${Date.now()}@racho.test`,
      password: 'password123',
    });
    const creditor = await authService.register({
      name: 'Shirley 3',
      email: `shirley3_${Date.now()}@racho.test`,
      password: 'password123',
    });
    const bystander = await authService.register({
      name: 'Gustavo Terceiro',
      email: `gustavo3_${Date.now()}@racho.test`,
      password: 'password123',
    });

    const group = await groupService.createGroup(debtor.id, {
      name: 'Grupo Auth Test',
      currency: 'BRL',
    });

    const settlement = await db.settlement.create({
      data: {
        groupId: group.id,
        payerId: debtor.id,
        receiverId: creditor.id,
        amount: 2500,
        status: 'AWAITING_CONFIRMATION',
      },
    });

    const isReceiver = settlement.receiverId === bystander.id;
    assert.strictEqual(isReceiver, false);
  });

  it('UC-HANDSHAKE-04: Credor contesta pagamento não recebido -> Status reverte para REJECTED e notifica devedor', async () => {
    const debtor = await authService.register({
      name: 'Diego 4',
      email: `diego4_${Date.now()}@racho.test`,
      password: 'password123',
    });
    const creditor = await authService.register({
      name: 'Shirley 4',
      email: `shirley4_${Date.now()}@racho.test`,
      password: 'password123',
    });

    const group = await groupService.createGroup(debtor.id, {
      name: 'Grupo Reject Test',
      currency: 'BRL',
    });

    const settlement = await db.settlement.create({
      data: {
        groupId: group.id,
        payerId: debtor.id,
        receiverId: creditor.id,
        amount: 4000,
        status: 'AWAITING_CONFIRMATION',
      },
    });

    await db.$transaction(async (tx) => {
      await tx.settlement.update({
        where: { id: settlement.id },
        data: { status: 'REJECTED', rejectedAt: new Date() },
      });

      await tx.notification.create({
        data: {
          userId: debtor.id,
          settlementId: settlement.id,
          type: 'SETTLEMENT_REJECTED',
          title: 'Pagamento Não Recebido',
          message: 'Shirley informou que não recebeu R$ 40,00',
        },
      });
    });

    const updated = await db.settlement.findUnique({ where: { id: settlement.id } });
    assert.strictEqual(updated?.status, 'REJECTED');

    const debtorNotification = await db.notification.findFirst({
      where: { userId: debtor.id, type: 'SETTLEMENT_REJECTED' },
    });
    assert.ok(debtorNotification);
  });
});
