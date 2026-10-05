import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createGroupSchema } from '@racho/shared';
import { z } from 'zod';
import { GroupService } from './group.service';
import { authenticate } from '../../shared/middlewares/authenticate';

export async function groupRoutes(app: FastifyInstance) {
  const groupService = new GroupService();
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook('onRequest', authenticate);

  // POST /groups - Criar novo grupo
  typedApp.post('/', { schema: { body: createGroupSchema } }, async (request, reply) => {
    const userId = request.user.sub;
    try {
      const group = await groupService.createGroup(userId, request.body);
      return reply.status(201).send({ group });
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  });

  // GET /groups - Listar grupos do usuário logado
  typedApp.get('/', async (request, reply) => {
    const userId = request.user.sub;
    const groups = await groupService.getUserGroups(userId);
    return reply.send({ groups });
  });

  // GET /groups/:groupId - Detalhes do grupo e membros
  typedApp.get(
    '/:groupId',
    { schema: { params: z.object({ groupId: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = request.user.sub;
      const { groupId } = request.params;
      try {
        const group = await groupService.getGroupDetails(groupId, userId);
        return reply.send({ group });
      } catch (err: any) {
        return reply.status(404).send({ message: err.message });
      }
    }
  );

  // POST /groups/join - Entrar em um grupo via inviteCode
  typedApp.post(
    '/join',
    { schema: { body: z.object({ inviteCode: z.string().min(1) }) } },
    async (request, reply) => {
      const userId = request.user.sub;
      const { inviteCode } = request.body;
      try {
        const group = await groupService.joinGroupViaInvite(userId, inviteCode);
        return reply.send({ message: 'Entrou no grupo com sucesso', group });
      } catch (err: any) {
        return reply.status(400).send({ message: err.message });
      }
    }
  );
}
