import { z } from 'zod';

export const notificationTypeEnum = z.enum([
  'SETTLEMENT_AWAITING_APPROVAL',
  'SETTLEMENT_CONFIRMED',
  'SETTLEMENT_REJECTED',
]);

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  settlementId: z.string().uuid().nullable().optional(),
  type: notificationTypeEnum,
  title: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
  settlement: z
    .object({
      id: z.string().uuid(),
      groupId: z.string().uuid(),
      payerId: z.string().uuid(),
      receiverId: z.string().uuid(),
      amount: z.number().int(),
      status: z.string(),
      payer: z.object({ id: z.string(), name: z.string() }).optional(),
      receiver: z.object({ id: z.string(), name: z.string() }).optional(),
      group: z.object({ id: z.string(), name: z.string() }).optional(),
    })
    .nullable()
    .optional(),
});

export type NotificationType = z.infer<typeof notificationTypeEnum>;
export type NotificationResponse = z.infer<typeof notificationSchema>;
