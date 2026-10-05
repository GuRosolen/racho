import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '@racho/db';
import { authenticate } from '../../shared/middlewares/authenticate';

export async function receiptRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook('onRequest', authenticate);

  typedApp.post('/scan', async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ message: 'Nenhuma imagem de nota fiscal enviada' });
      }

      const mockMerchantName = 'Restaurante Sabor & Mar';
      const mockItems = [
        { name: '2x Hambúrguer Gourmet', quantity: 2, unitPrice: 3000, totalPrice: 6000 },
        { name: '1x Suco Natural de Laranja', quantity: 1, unitPrice: 1000, totalPrice: 1000 },
        { name: '1x Sobremesa Petit Gateau', quantity: 1, unitPrice: 3000, totalPrice: 3000 },
      ];
      const subtotalAmount = 10000;
      const taxAmount = 1000;
      const totalAmount = 11000;

      const receipt = await db.expenseReceipt.create({
        data: {
          imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
          merchantName: mockMerchantName,
          subtotalAmount,
          taxAmount,
          totalAmount,
          rawOcrJson: JSON.stringify({ mockItems, totalAmount }),
          status: 'PROCESSED',
          items: {
            create: mockItems.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: { items: true },
      });

      const responsePayload = {
        receiptId: receipt.id,
        imageUrl: receipt.imageUrl,
        merchantName: receipt.merchantName,
        date: receipt.createdAt.toISOString(),
        items: receipt.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
        subtotalAmount: receipt.subtotalAmount || subtotalAmount,
        taxAmount: receipt.taxAmount || taxAmount,
        totalAmount: receipt.totalAmount || totalAmount,
      };

      return reply.status(201).send(responsePayload);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message || 'Erro ao processar cupom fiscal' });
    }
  });
}
