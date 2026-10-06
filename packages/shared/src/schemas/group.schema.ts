import { z } from 'zod';

export const currencyEnum = z.enum(['BRL', 'USD', 'EUR', 'GBP']);

export const createGroupSchema = z.object({
  name: z.string().min(2, 'Nome do grupo é obrigatório'),
  description: z.string().optional(),
  currency: currencyEnum.default('BRL'),
});

export const groupMemberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
  joinedAt: z.string(),
});

export const groupDetailsSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  currency: currencyEnum,
  inviteCode: z.string(),
  createdAt: z.string(),
  members: z.array(groupMemberSchema),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().min(1, 'Código de convite é obrigatório'),
});

export const groupInvitePreviewSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  currency: currencyEnum,
  memberCount: z.number(),
  inviteCode: z.string(),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type GroupDetails = z.infer<typeof groupDetailsSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
export type GroupInvitePreview = z.infer<typeof groupInvitePreviewSchema>;
