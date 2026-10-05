import { z } from 'zod';
import { currencyEnum } from './group.schema';

export const createSettlementSchema = z.object({
  groupId: z.string().uuid(),
  receiverId: z.string().uuid('ID do credor inválido'),
  amount: z.number().int().positive('O valor da liquidação deve ser positivo em centavos'),
  currency: currencyEnum.default('BRL'),
  note: z.string().optional(),
});

export const simplifiedDebtSchema = z.object({
  fromUserId: z.string().uuid(),
  fromUserName: z.string(),
  toUserId: z.string().uuid(),
  toUserName: z.string(),
  amount: z.number().int().positive(),
  currency: currencyEnum,
});

export const groupBalanceSummarySchema = z.object({
  userId: z.string().uuid(),
  userName: z.string(),
  netBalance: z.number().int(),
});

export const groupBalancesResponseSchema = z.object({
  groupId: z.string().uuid(),
  currency: currencyEnum,
  balances: z.array(groupBalanceSummarySchema),
  simplifiedDebts: z.array(simplifiedDebtSchema),
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
export type SimplifiedDebt = z.infer<typeof simplifiedDebtSchema>;
export type GroupBalancesResponse = z.infer<typeof groupBalancesResponseSchema>;
