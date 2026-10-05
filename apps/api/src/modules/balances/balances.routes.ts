import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { BalancesService } from './balances.service';
import { authenticate } from '../../shared/middlewares/authenticate';

export async function balancesRoutes(app: FastifyInstance) {
  const balancesService = new BalancesService();
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook('onRequest', authenticate);

  // GET /balances/group/:groupId - Saldos líquidos e dívidas simplificadas do grupo
  typedApp.get(
    '/group/:groupId',
    { schema: { params: z.object({ groupId: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = request.user.sub;
      const { groupId } = request.params;
      try {
        const result = await balancesService.getGroupBalances(groupId, userId);
        return reply.send(result);
      } catch (err: any) {
        return reply.status(400).send({ message: err.message });
      }
    }
  );
}
