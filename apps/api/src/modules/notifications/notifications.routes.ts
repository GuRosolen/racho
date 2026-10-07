import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '@racho/db';
import { z } from 'zod';
import { authenticate } from '../../shared/middlewares/authenticate';

export async function notificationRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook('onRequest', authenticate);

  // GET /notifications/unread-count - Obter contador de notificações não lidas para o badge (+1)
  typedApp.get('/unread-count', async (request, reply) => {
    const userId = request.user.sub;
    const count = await db.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    return reply.send({ unreadCount: count });
  });

  // GET /notifications - Listar notificações do usuário logado
  typedApp.get('/', async (request, reply) => {
    const userId = request.user.sub;

    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        settlement: {
          select: {
            id: true,
            groupId: true,
            payerId: true,
            receiverId: true,
            amount: true,
            status: true,
            payer: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } },
            group: { select: { id: true, name: true } },
          },
        },
      },
    });

    return reply.send({ notifications });
  });

  // PATCH /notifications/:id/read - Marcar notificação individual como lida
  typedApp.patch(
    '/:id/read',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = request.user.sub;
      const { id } = request.params;

      const updated = await db.notification.updateMany({
        where: { id, userId },
        data: { read: true },
      });

      return reply.send({ success: true, updatedCount: updated.count });
    }
  );

  // POST /notifications/read-all - Marcar todas as notificações do usuário como lidas
  typedApp.post('/read-all', async (request, reply) => {
    const userId = request.user.sub;

    const updated = await db.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return reply.send({ success: true, updatedCount: updated.count });
  });
}
