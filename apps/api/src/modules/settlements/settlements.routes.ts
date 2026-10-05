import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createSettlementSchema } from '@racho/shared';
import { db, AuditAction } from '@racho/db';
import { authenticate } from '../../shared/middlewares/authenticate';

export async function settlementRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook('onRequest', authenticate);

  typedApp.post('/', { schema: { body: createSettlementSchema } }, async (request, reply) => {
    const userId = request.user.sub;
    const { groupId, receiverId, amount, currency, note } = request.body;

    try {
      const membership = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });

      if (!membership) {
        return reply.status(403).send({ message: 'Você não é membro deste grupo' });
      }

      const settlement = await db.$transaction(async (tx) => {
        const item = await tx.settlement.create({
          data: {
            groupId,
            payerId: userId,
            receiverId,
            amount,
            currency: currency || 'BRL',
            note,
          },
          include: {
            payer: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } },
          },
        });

        await tx.auditLog.create({
          data: {
            groupId,
            userId,
            action: AuditAction.CREATE_SETTLEMENT,
            entityType: 'SETTLEMENT',
            entityId: item.id,
            payload: JSON.stringify({ amount, receiverId, note }),
          },
        });

        return item;
      });

      return reply.status(201).send({ settlement });
    } catch (err: any) {
      return reply.status(400).send({ message: err.message || 'Erro ao registrar liquidação' });
    }
  });
}
