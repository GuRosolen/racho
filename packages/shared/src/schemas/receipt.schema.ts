import { z } from 'zod';

export const parsedReceiptItemSchema = z.object({
  name: z.string().describe('Nome do produto ou serviço lido na nota'),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().int().nonnegative().describe('Preço unitário em centavos'),
  totalPrice: z.number().int().nonnegative().describe('Preço total do item em centavos'),
});

export const parseReceiptResponseSchema = z.object({
  receiptId: z.string().uuid(),
  imageUrl: z.string().url(),
  merchantName: z.string().nullable().describe('Nome do estabelecimento comercial'),
  date: z.string().nullable().describe('Data da nota fiscal em formato ISO'),
  items: z.array(parsedReceiptItemSchema),
  subtotalAmount: z.number().int().nonnegative().describe('Subtotal dos itens em centavos'),
  taxAmount: z.number().int().nonnegative().describe('Gorjeta/Taxa de serviço/Frete em centavos'),
  totalAmount: z.number().int().positive().describe('Valor total final da nota em centavos'),
});

export type ParsedReceiptResponse = z.infer<typeof parseReceiptResponseSchema>;
