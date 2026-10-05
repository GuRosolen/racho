import { db, GroupRole } from '@racho/db';
import { CreateGroupInput } from '@racho/shared';

export class GroupService {
  async createGroup(userId: string, input: CreateGroupInput) {
    const group = await db.group.create({
      data: {
        name: input.name,
        description: input.description,
        currency: input.currency || 'BRL',
        members: {
          create: {
            userId,
            role: GroupRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return group;
  }

  async getUserGroups(userId: string) {
    const memberships = await db.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: {
              select: { members: true, expenses: true },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.group,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async getGroupDetails(groupId: string, userId: string) {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!membership) {
      throw new Error('Você não pertence a este grupo de despesas');
    }

    const group = await db.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!group) {
      throw new Error('Grupo não encontrado');
    }

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      currency: group.currency,
      inviteCode: group.inviteCode,
      createdAt: group.createdAt.toISOString(),
      members: group.members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  async joinGroupViaInvite(userId: string, inviteCode: string) {
    const group = await db.group.findUnique({
      where: { inviteCode },
    });

    if (!group) {
      throw new Error('Código de convite inválido ou expirado');
    }

    const existingMember = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } },
    });

    if (existingMember) {
      return group;
    }

    await db.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: GroupRole.MEMBER,
      },
    });

    return group;
  }
}
