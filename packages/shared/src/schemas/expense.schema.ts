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

export const expenseItemInputSchema = z
  .object({
    name: z.string().min(1, 'Nome do item é obrigatório'),
    quantity: z.number().int().positive().default(1),
    unitPrice: z.number().int().positive('Preço unitário deve ser positivo em centavos'),
    totalPrice: z.number().int().positive('Preço total do item deve ser positivo em centavos').optional(),
    assignedUserIds: z.array(z.string().uuid()).optional(),
    assignedMemberIds: z.array(z.string().uuid()).optional(),
  })
  .transform((item) => {
    const qty = item.quantity ?? 1;
    const calculatedTotal = item.unitPrice * qty;
    const userIds = item.assignedUserIds || item.assignedMemberIds || [];
    return {
      name: item.name,
      quantity: qty,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice ?? calculatedTotal,
      assignedUserIds: userIds,
      assignedMemberIds: userIds,
    };
  })
  .refine((item) => item.assignedUserIds.length > 0, {
    message: 'Ao menos um membro deve ser associado ao item',
    path: ['assignedUserIds'],
  });

export const createExpenseSchema = z
  .object({
    groupId: z.string().uuid('ID de grupo inválido'),
    description: z.string().min(1, 'Descrição é obrigatória'),
    amount: z.number().int().positive('Valor total da despesa deve ser positivo em centavos'),
    taxAmount: z.number().int().nonnegative('Taxa deve ser um inteiro não-negativo em centavos').default(0),
    currency: currencyEnum.default('BRL'),
    category: expenseCategoryEnum.default('OTHER'),
    splitType: splitTypeEnum.default('EQUAL'),
    date: z.string().optional(),
    receiptId: z.string().uuid().optional(),
    payers: z.array(expensePayerInputSchema).min(1, 'Ao menos um pagador deve ser informado'),
    memberIds: z.array(z.string().uuid()).min(1).optional(), // Subconjunto de membros no modo EQUAL
    splits: z.array(expenseSplitInputSchema).optional(),
    items: z.array(expenseItemInputSchema).optional(), // Itens consumidos no modo ITEMIZED
    itemAssignments: z.array(itemAssignmentInputSchema).optional(),
  })
  .refine(
    (data) => {
      const totalPaid = data.payers.reduce((acc, p) => acc + p.amountPaid, 0);
      return totalPaid === data.amount;
    },
    {
      message: 'A soma dos valores pagos deve ser exatamente igual ao valor total da despesa',
      path: ['payers'],
    }
  )
  .refine(
    (data) => {
      if (data.splitType === 'ITEMIZED') {
        if (!data.items || data.items.length === 0) return false;
        const totalItemsPrice = data.items.reduce((acc, i) => acc + i.totalPrice, 0);
        return totalItemsPrice + (data.taxAmount || 0) === data.amount;
      }
      return true;
    },
    {
      message: 'No modo itemizado, a soma dos itens + taxas deve ser exatamente igual ao valor total da despesa',
      path: ['items'],
    }
  );

export type ExpenseItemInput = z.input<typeof expenseItemInputSchema>;
export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type CreateExpenseOutput = z.output<typeof createExpenseSchema>;

export const updateExpenseSchema = z
  .object({
    version: z.number().int().positive('A versão atual da despesa é obrigatória para o bloqueio otimista'),
    description: z.string().min(1, 'Descrição é obrigatória'),
    amount: z.number().int().positive('Valor total da despesa deve ser positivo em centavos'),
    taxAmount: z.number().int().nonnegative('Taxa deve ser um inteiro não-negativo em centavos').default(0),
    currency: currencyEnum.default('BRL'),
    category: expenseCategoryEnum.default('OTHER'),
    splitType: splitTypeEnum.default('EQUAL'),
    date: z.string().optional(),
    receiptId: z.string().uuid().optional(),
    payers: z.array(expensePayerInputSchema).min(1, 'Ao menos um pagador deve ser informado'),
    memberIds: z.array(z.string().uuid()).min(1).optional(),
    splits: z.array(expenseSplitInputSchema).optional(),
    items: z.array(expenseItemInputSchema).optional(),
    itemAssignments: z.array(itemAssignmentInputSchema).optional(),
  })
  .refine(
    (data) => {
      const totalPaid = data.payers.reduce((acc, p) => acc + p.amountPaid, 0);
      return totalPaid === data.amount;
    },
    {
      message: 'A soma dos valores pagos deve ser exatamente igual ao valor total da despesa',
      path: ['payers'],
    }
  )
  .refine(
    (data) => {
      if (data.splitType === 'ITEMIZED') {
        if (!data.items || data.items.length === 0) return false;
        const totalItemsPrice = data.items.reduce((acc, i) => acc + i.totalPrice, 0);
        return totalItemsPrice + (data.taxAmount || 0) === data.amount;
      }
      return true;
    },
    {
      message: 'No modo itemizado, a soma dos itens + taxas deve ser exatamente igual ao valor total da despesa',
      path: ['items'],
    }
  );

export type UpdateExpenseInput = z.input<typeof updateExpenseSchema>;


