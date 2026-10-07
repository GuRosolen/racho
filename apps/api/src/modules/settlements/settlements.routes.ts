import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createSettlementSchema, formatCentsToCurrency } from '@racho/shared';
import { db, AuditAction, SettlementStatus } from '@racho/db';
import { z } from 'zod';
import { authenticate } from '../../shared/middlewares/authenticate';

export async function settlementRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook('onRequest', authenticate);

  // POST /settlements - Iniciar pagamento / Criar liquidação
  typedApp.post('/', { schema: { body: createSettlementSchema } }, async (request, reply) => {
    const userId = request.user.sub;
    const { groupId, receiverId, amount, currency, note, status } = request.body;

    try {
      const membership = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });

      if (!membership) {
        return reply.status(403).send({ message: 'Você não é membro deste grupo' });
      }

      const group = await db.group.findUnique({ where: { id: groupId } });
      const payer = await db.user.findUnique({ where: { id: userId } });
      const receiver = await db.user.findUnique({ where: { id: receiverId } });

      if (!group || !payer || !receiver) {
        return reply.status(404).send({ message: 'Dados do grupo ou usuários inválidos' });
      }

      const desiredStatus: SettlementStatus = status ? (status as SettlementStatus) : 'AWAITING_CONFIRMATION';

      const settlement = await db.$transaction(async (tx) => {
        // Verificar se já existe acerto pendente entre os 2 usuários neste grupo
        const existing = await tx.settlement.findFirst({
          where: {
            groupId,
            payerId: userId,
            receiverId,
            status: { in: ['PENDING', 'AWAITING_CONFIRMATION', 'REJECTED'] },
          },
        });

        let item;
        if (existing) {
          item = await tx.settlement.update({
            where: { id: existing.id },
            data: {
              amount,
              status: desiredStatus,
              paidAt: desiredStatus === 'AWAITING_CONFIRMATION' ? new Date() : undefined,
              note: note ?? existing.note,
            },
            include: {
              payer: { select: { id: true, name: true } },
              receiver: { select: { id: true, name: true } },
            },
          });
        } else {
          item = await tx.settlement.create({
            data: {
              groupId,
              payerId: userId,
              receiverId,
              amount,
              currency: currency || 'BRL',
              status: desiredStatus,
              paidAt: desiredStatus === 'AWAITING_CONFIRMATION' ? new Date() : undefined,
              note,
              updatedAt: new Date(),
            },
            include: {
              payer: { select: { id: true, name: true } },
              receiver: { select: { id: true, name: true } },
            },
          });
        }

        // Criar notificação para o credor se o status for AWAITING_CONFIRMATION
        if (desiredStatus === 'AWAITING_CONFIRMATION') {
          await tx.notification.create({
            data: {
              userId: receiverId,
              settlementId: item.id,
              type: 'SETTLEMENT_AWAITING_APPROVAL',
              title: 'Solicitação de Confirmação de Pagamento',
              message: `${payer.name} marcou o pagamento de ${formatCentsToCurrency(amount)} como realizado no grupo ${group.name}`,
            },
          });
        }

        return item;
      });

      return reply.status(201).send({ settlement });
    } catch (err: any) {
      return reply.status(400).send({ message: err.message || 'Erro ao registrar liquidação' });
    }
  });

  // POST /settlements/:id/pay - Devedor marca como pago
  typedApp.post(
    '/:id/pay',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = request.user.sub;
      const { id } = request.params;

      try {
        const settlement = await db.settlement.findUnique({
          where: { id },
          include: {
            group: { select: { name: true } },
            payer: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } },
          },
        });

        if (!settlement) {
          return reply.status(404).send({ message: 'Liquidação não encontrada' });
        }

        if (settlement.payerId !== userId) {
          return reply.status(403).send({ message: 'Apenas o devedor desta transação pode marcar como pago' });
        }

        const updated = await db.$transaction(async (tx) => {
          const item = await tx.settlement.update({
            where: { id },
            data: {
              status: 'AWAITING_CONFIRMATION',
              paidAt: new Date(),
            },
            include: {
              payer: { select: { id: true, name: true } },
              receiver: { select: { id: true, name: true } },
            },
          });

          await tx.notification.create({
            data: {
              userId: settlement.receiverId,
              settlementId: item.id,
              type: 'SETTLEMENT_AWAITING_APPROVAL',
              title: 'Solicitação de Confirmação de Pagamento',
              message: `${settlement.payer.name} marcou o pagamento de ${formatCentsToCurrency(settlement.amount)} como realizado no grupo ${settlement.group.name}`,
            },
          });

          return item;
        });

        return reply.send({ settlement: updated });
      } catch (err: any) {
        return reply.status(400).send({ message: err.message || 'Erro ao marcar pagamento como realizado' });
      }
    }
  );

  // POST /settlements/:id/confirm - Credor confirma recebimento (baixa o saldo)
  typedApp.post(
    '/:id/confirm',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = request.user.sub;
      const { id } = request.params;

      try {
        const settlement = await db.settlement.findUnique({
          where: { id },
          include: {
            group: { select: { name: true } },
            payer: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } },
          },
        });

        if (!settlement) {
          return reply.status(404).send({ message: 'Liquidação não encontrada' });
        }

        if (settlement.receiverId !== userId) {
          return reply.status(403).send({ message: 'Apenas o cobrador/credor desta transação pode confirmar o recebimento' });
        }

        const updated = await db.$transaction(async (tx) => {
          const item = await tx.settlement.update({
            where: { id },
            data: {
              status: 'CONFIRMED',
              confirmedAt: new Date(),
            },
            include: {
              payer: { select: { id: true, name: true } },
              receiver: { select: { id: true, name: true } },
            },
          });

          // Marcar notificações deste settlement como lidas
          await tx.notification.updateMany({
            where: { settlementId: id },
            data: { read: true },
          });

          // Notificar devedor da confirmação
          await tx.notification.create({
            data: {
              userId: settlement.payerId,
              settlementId: item.id,
              type: 'SETTLEMENT_CONFIRMED',
              title: 'Pagamento Confirmado',
              message: `${settlement.receiver.name} confirmou o recebimento de ${formatCentsToCurrency(settlement.amount)} no grupo ${settlement.group.name}`,
            },
          });

          // Log de Auditoria
          await tx.auditLog.create({
            data: {
              groupId: settlement.groupId,
              userId,
              action: AuditAction.CREATE_SETTLEMENT,
              entityType: 'SETTLEMENT',
              entityId: item.id,
              payload: JSON.stringify({ amount: settlement.amount, receiverId: settlement.receiverId }),
            },
          });

          return item;
        });

        return reply.send({ settlement: updated });
      } catch (err: any) {
        return reply.status(400).send({ message: err.message || 'Erro ao confirmar recebimento' });
      }
    }
  );

  // POST /settlements/:id/reject - Credor contesta pagamento não recebido
  typedApp.post(
    '/:id/reject',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = request.user.sub;
      const { id } = request.params;

      try {
        const settlement = await db.settlement.findUnique({
          where: { id },
          include: {
            group: { select: { name: true } },
            payer: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } },
          },
        });

        if (!settlement) {
          return reply.status(404).send({ message: 'Liquidação não encontrada' });
        }

        if (settlement.receiverId !== userId) {
          return reply.status(403).send({ message: 'Apenas o cobrador/credor desta transação pode contestar o recebimento' });
        }

        const updated = await db.$transaction(async (tx) => {
          const item = await tx.settlement.update({
            where: { id },
            data: {
              status: 'REJECTED',
              rejectedAt: new Date(),
            },
            include: {
              payer: { select: { id: true, name: true } },
              receiver: { select: { id: true, name: true } },
            },
          });

          // Baixar notificação de aprovação pendente do credor
          await tx.notification.updateMany({
            where: { settlementId: id, userId },
            data: { read: true },
          });

          // Notificar devedor sobre a contestação
          await tx.notification.create({
            data: {
              userId: settlement.payerId,
              settlementId: item.id,
              type: 'SETTLEMENT_REJECTED',
              title: 'Pagamento Não Recebido / Contestado',
              message: `${settlement.receiver.name} informou que não recebeu o pagamento de ${formatCentsToCurrency(settlement.amount)} no grupo ${settlement.group.name}`,
            },
          });

          return item;
        });

        return reply.send({ settlement: updated });
      } catch (err: any) {
        return reply.status(400).send({ message: err.message || 'Erro ao contestar pagamento' });
      }
    }
  );
}
