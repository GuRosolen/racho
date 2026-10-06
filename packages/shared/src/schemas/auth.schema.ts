import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

export const authResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    avatarUrl: z.string().nullable(),
    pixKey: z.string().nullable().optional(),
    pixKeyType: z.enum(['CPF', 'EMAIL', 'PHONE', 'RANDOM']).nullable().optional(),
  }),
  accessToken: z.string(),
});

export const pixKeyTypeEnum = z.enum(['CPF', 'EMAIL', 'PHONE', 'RANDOM']);

export const updateProfileSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
    avatarUrl: z.string().url().nullable().optional(),
    pixKeyType: pixKeyTypeEnum.nullable().optional(),
    pixKey: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (!data.pixKey && !data.pixKeyType) return true;
      if (data.pixKey && !data.pixKeyType) return false;
      if (!data.pixKey && data.pixKeyType) return false;

      const key = data.pixKey!.trim();
      const type = data.pixKeyType!;

      if (type === 'CPF') {
        const cleanCpf = key.replace(/\D/g, '');
        return cleanCpf.length === 11 || cleanCpf.length === 14;
      }
      if (type === 'EMAIL') {
        return z.string().email().safeParse(key).success;
      }
      if (type === 'PHONE') {
        const cleanPhone = key.replace(/\D/g, '');
        return cleanPhone.length >= 10 && cleanPhone.length <= 13;
      }
      if (type === 'RANDOM') {
        return key.length >= 10;
      }
      return true;
    },
    {
      message: 'Formato de chave Pix inválido para o tipo selecionado',
      path: ['pixKey'],
    }
  );

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

