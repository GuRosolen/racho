import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { db, GroupRole } from '@racho/db';
import { GroupService } from './group.service';
import bcrypt from 'bcryptjs';

describe('GroupService - Convites e Adesão via Link/Token (Etapa 1)', () => {
  const groupService = new GroupService();

  let userAId: string;
  let userBId: string;
  let testGroupId: string;
  let initialInviteCode: string;

  before(async () => {
    const passwordHash = await bcrypt.hash('senha123', 8);

    // Criar Usuário A (Criador / Dono)
    const userA = await db.user.create({
      data: {
        name: 'Usuário A Teste',
        email: `usera_invite_${Date.now()}@racho.test`,
        passwordHash,
      },
    });
    userAId = userA.id;

    // Criar Usuário B (Convidado)
    const userB = await db.user.create({
      data: {
        name: 'Usuário B Teste',
        email: `userb_invite_${Date.now()}@racho.test`,
        passwordHash,
      },
    });
    userBId = userB.id;
  });

  after(async () => {
    // Limpeza dos dados de teste
    if (testGroupId) {
      await db.group.delete({ where: { id: testGroupId } }).catch(() => {});
    }
    if (userAId) {
      await db.user.delete({ where: { id: userAId } }).catch(() => {});
    }
    if (userBId) {
      await db.user.delete({ where: { id: userBId } }).catch(() => {});
    }
  });

  it('1. Deve criar um grupo e gerar um inviteCode único e válido', async () => {
    const group = await groupService.createGroup(userAId, {
      name: 'Grupo Viagem de Teste',
      description: 'Grupo para testes de convite seguro',
      currency: 'BRL',
    });

    assert.ok(group.id, 'Grupo deve possuir um ID');
    assert.ok(group.inviteCode, 'Grupo deve possuir um inviteCode');
    assert.strictEqual(group.members.length, 1);
    assert.strictEqual(group.members[0].userId, userAId);
    assert.strictEqual(group.members[0].role, GroupRole.OWNER);

    testGroupId = group.id;
    initialInviteCode = group.inviteCode;
  });

  it('2. Deve obter a prévia pública do grupo através do inviteCode sem vazar dados sensíveis', async () => {
    const preview = await groupService.getGroupPreviewByInviteCode(initialInviteCode);

    assert.strictEqual(preview.id, testGroupId);
    assert.strictEqual(preview.name, 'Grupo Viagem de Teste');
    assert.strictEqual(preview.description, 'Grupo para testes de convite seguro');
    assert.strictEqual(preview.currency, 'BRL');
    assert.strictEqual(preview.memberCount, 1);
    assert.strictEqual(preview.inviteCode, initialInviteCode);
  });

  it('3. Deve rejeitar consulta de prévia com código de convite inexistente', async () => {
    await assert.rejects(
      async () => {
        await groupService.getGroupPreviewByInviteCode('codigo_totalmente_invalido_xyz');
      },
      /Código de convite inválido ou expirado/
    );
  });

  it('4. Usuário B deve ingressar no grupo através do inviteCode gerando auditoria MEMBER_JOINED', async () => {
    const joined = await groupService.joinGroupViaInvite(userBId, initialInviteCode);
    assert.strictEqual(joined.id, testGroupId);

    // Verificar se Usuário B agora é membro no banco de dados
    const membership = await db.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: testGroupId,
          userId: userBId,
        },
      },
    });

    assert.ok(membership, 'Usuário B deve existir como membro do grupo');
    assert.strictEqual(membership.role, GroupRole.MEMBER);

    // Verificar log de auditoria
    const auditLog = await db.auditLog.findFirst({
      where: {
        groupId: testGroupId,
        userId: userBId,
        action: 'MEMBER_JOINED',
      },
    });

    assert.ok(auditLog, 'Deve existir registro de auditoria MEMBER_JOINED');
  });

  it('5. Deve ser idempotente: nova tentativa de entrada do Usuário B não duplica membros nem falha', async () => {
    const reJoined = await groupService.joinGroupViaInvite(userBId, initialInviteCode);
    assert.strictEqual(reJoined.id, testGroupId);

    const count = await db.groupMember.count({
      where: { groupId: testGroupId, userId: userBId },
    });
    assert.strictEqual(count, 1, 'Não deve haver duplicidade de membros');
  });

  it('6. Usuário A (Dono) pode regenerar o inviteCode, invalidando o código anterior', async () => {
    const updated = await groupService.regenerateInviteCode(testGroupId, userAId);
    assert.ok(updated.inviteCode, 'Novo inviteCode deve ter sido gerado');
    assert.notStrictEqual(updated.inviteCode, initialInviteCode, 'Novo código deve ser diferente do anterior');

    // Código antigo agora deve falhar
    await assert.rejects(
      async () => {
        await groupService.getGroupPreviewByInviteCode(initialInviteCode);
      },
      /Código de convite inválido ou expirado/
    );

    // Novo código deve funcionar
    const newPreview = await groupService.getGroupPreviewByInviteCode(updated.inviteCode);
    assert.strictEqual(newPreview.id, testGroupId);
    assert.strictEqual(newPreview.memberCount, 2);
  });

  it('7. Usuário B (Membro comum) não tem permissão para regenerar o inviteCode', async () => {
    await assert.rejects(
      async () => {
        await groupService.regenerateInviteCode(testGroupId, userBId);
      },
      /Apenas administradores ou o criador do grupo podem redefinir o link de convite/
    );
  });
});
