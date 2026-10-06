import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createExpenseSchema, updateExpenseSchema } from '@racho/shared';
import { z } from 'zod';
import { ExpenseService } from './expense.service';
import { authenticate } from '../../shared/middlewares/authenticate';

export async function expenseRoutes(app: FastifyInstance) {
  const expenseService = new ExpenseService();
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook('onRequest', authenticate);

  // POST /expenses - Criar nova despesa
  typedApp.post('/', { schema: { body: createExpenseSchema } }, async (request, reply) => {
    const userId = request.user.sub;
    try {
      const expense = await expenseService.createExpense(userId, request.body);
      return reply.status(201).send({ expense });
    } catch (err: any) {
      const status = err.statusCode || 400;
      return reply.status(status).send({ message: err.message });
    }
  });

  // PUT /expenses/:groupId/:expenseId ou PUT /expenses/:expenseId - Editar despesa com OCC
  typedApp.put(
    '/:groupId/:expenseId',
    {
      schema: {
        params: z.object({ groupId: z.string().uuid(), expenseId: z.string().uuid() }),
        body: updateExpenseSchema,
      },
    },
    async (request, reply) => {
      const userId = request.user.sub;
      const { groupId, expenseId } = request.params;
      try {
        const expense = await expenseService.updateExpense(userId, groupId, expenseId, request.body);
        return reply.send({ expense });
      } catch (err: any) {
        const status = err.statusCode || 400;
        return reply.status(status).send({ message: err.message });
      }
    }
  );

  typedApp.put(
    '/:expenseId',
    {
      schema: {
        params: z.object({ expenseId: z.string().uuid() }),
        body: updateExpenseSchema,
      },
    },
    async (request, reply) => {
      const userId = request.user.sub;
      const { expenseId } = request.params;
      try {
        // Obter groupId a partir do body se enviado, ou buscar a despesa
        const { db } = await import('@racho/db');
        const existing = await db.expense.findUnique({ where: { id: expenseId } });
        if (!existing) {
          return reply.status(404).send({ message: 'Despesa não encontrada' });
        }
        const expense = await expenseService.updateExpense(userId, existing.groupId, expenseId, request.body);
        return reply.send({ expense });
      } catch (err: any) {
        const status = err.statusCode || 400;
        return reply.status(status).send({ message: err.message });
      }
    }
  );

  // GET /expenses/group/:groupId - Listar extrato de despesas do grupo
  typedApp.get(
    '/group/:groupId',
    { schema: { params: z.object({ groupId: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = request.user.sub;
      const { groupId } = request.params;
      try {
        const expenses = await expenseService.getGroupExpenses(groupId, userId);
        return reply.send({ expenses });
      } catch (err: any) {
        const status = err.statusCode || 400;
        return reply.status(status).send({ message: err.message });
      }
    }
  );

  // DELETE /expenses/:expenseId - Excluir despesa
  typedApp.delete(
    '/:expenseId',
    { schema: { params: z.object({ expenseId: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = request.user.sub;
      const { expenseId } = request.params;
      try {
        const result = await expenseService.deleteExpense(expenseId, userId);
        return reply.send(result);
      } catch (err: any) {
        const status = err.statusCode || 400;
        return reply.status(status).send({ message: err.message });
      }
    }
  );
}

