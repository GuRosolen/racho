import { db } from '@racho/db';
import { RegisterInput, LoginInput, UpdateProfileInput } from '@racho/shared';
import bcrypt from 'bcryptjs';

export class AuthService {
  async register(input: RegisterInput) {
    const existingUser = await db.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error('Já existe um usuário cadastrado com este e-mail');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      pixKey: user.pixKey,
      pixKeyType: user.pixKeyType,
    };
  }

  async login(input: LoginInput) {
    const user = await db.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new Error('E-mail ou senha incorretos');
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordValid) {
      throw new Error('E-mail ou senha incorretos');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      pixKey: user.pixKey,
      pixKeyType: user.pixKeyType,
    };
  }

  async getUserById(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        pixKey: true,
        pixKeyType: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: {
        name: input.name ?? user.name,
        avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : user.avatarUrl,
        pixKey: input.pixKey !== undefined ? input.pixKey : user.pixKey,
        pixKeyType: input.pixKeyType !== undefined ? (input.pixKeyType as any) : user.pixKeyType,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        pixKey: true,
        pixKeyType: true,
      },
    });

    return updated;
  }
}
