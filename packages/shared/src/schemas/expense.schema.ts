import { z } from 'zod';
import { currencyEnum } from './group.schema';

export const splitTypeEnum = z.enum(['EQUAL', 'PERCENTAGE', 'EXACT', 'ITEMIZED']);
export const expenseCategoryEnum = z.enum([
  'FOOD_AND_DRINK',
  'ACCOMMODATION',
  'TRANSPORTATION',
  'ENTERTAINMENT',
  'GROCERIES',
  'UTILITIES',
  'OTHER',
]);

export const expensePayerInputSchema = z.object({
  userId: z.string().uuid(),
  amountPaid: z.number().int().positive('O valor pago deve ser um número inteiro em centavos'),
});

export const expenseSplitInputSchema = z.object({
  userId: z.string().uuid(),
  shareAmount: z.number().int().nonnegative('O valor da cota deve ser um inteiro em centavos'),
  percentage: z.number().min(0).max(100).optional(),
});

export const itemAssignmentInputSchema = z.object({
  itemId: z.string().uuid(),
  userId: z.string().uuid(),
  assignedAmount: z.number().int().positive('Valor atribuído ao item em centavos'),
});

export const createExpenseSchema = z
  .object({
    groupId: z.string().uuid(),
    description: z.string().min(1, 'Descrição é obrigatória'),
    amount: z.number().int().positive('Valor total da despesa deve ser positivo em centavos'),
    currency: currencyEnum.default('BRL'),
    category: expenseCategoryEnum.default('OTHER'),
    splitType: splitTypeEnum.default('EQUAL'),
    date: z.string().optional(),
    receiptId: z.string().uuid().optional(),
    payers: z.array(expensePayerInputSchema).min(1, 'Ao menos um pagador deve ser informado'),
    splits: z.array(expenseSplitInputSchema).optional(),
    itemAssignments: z.array(itemAssignmentInputSchema).optional(),
  })
  .refine(
    (data) => {
      const totalPaid = data.payers.reduce((acc, p) => acc + p.amountPaid, 0);
      return totalPaid === data.amount;
    },
    {
      message: 'A soma dos valores pagos por todos os pagadores deve ser exatamente igual ao valor total da despesa',
      path: ['payers'],
    }
  );

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
