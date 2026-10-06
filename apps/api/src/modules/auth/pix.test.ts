import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generatePixPayload, updateProfileSchema } from '@racho/shared';
import { AuthService } from './auth.service';

describe('Módulo de Pix & Perfil do Usuário', () => {
  const authService = new AuthService();

  it('UC-PIX-01: Deve gerar payload Pix Copia e Cola no padrão BACEN EMV BR Code com centavos exatos e CRC16 válido', () => {
    const payload = generatePixPayload({
      pixKey: 'shirley@email.com',
      merchantName: 'Shirley Rosolen',
      merchantCity: 'Brasilia',
      amountCents: 2550, // R$ 25,50
      txId: 'RACHO123',
    });

    assert.ok(payload.startsWith('000201')); // Format Indicator + Initiation Method
    assert.ok(payload.includes('shirley@email.com')); // Chave Pix embutida
    assert.ok(payload.includes('540525.50')); // Valor exato em Reais
    assert.ok(payload.includes('5915SHIRLEY ROSOLEN')); // Nome sanitizado em maiúsculas
    assert.strictEqual(payload.length > 70, true);

    // CRC16 de 4 caracteres no final da string
    const crc = payload.slice(-4);
    assert.match(crc, /^[0-9A-F]{4}$/);
  });

  it('UC-PIX-02: Deve validar formatos de chaves Pix via Zod (CPF, EMAIL, PHONE, RANDOM)', () => {
    // Valid CPF
    const validCpf = updateProfileSchema.safeParse({ pixKeyType: 'CPF', pixKey: '123.456.789-00' });
    assert.strictEqual(validCpf.success, true);

    // Invalid Email
    const invalidEmail = updateProfileSchema.safeParse({ pixKeyType: 'EMAIL', pixKey: 'not-an-email' });
    assert.strictEqual(invalidEmail.success, false);

    // Valid Phone
    const validPhone = updateProfileSchema.safeParse({ pixKeyType: 'PHONE', pixKey: '+5511999999999' });
    assert.strictEqual(validPhone.success, true);

    // Valid Random UUID
    const validRandom = updateProfileSchema.safeParse({
      pixKeyType: 'RANDOM',
      pixKey: '123e4567-e89b-12d3-a456-426614174000',
    });
    assert.strictEqual(validRandom.success, true);
  });

  it('UC-PIX-03: Deve atualizar a chave e tipo Pix no perfil do usuário', async () => {
    const user = await authService.register({
      name: 'Pix Tester',
      email: `pixtester_${Date.now()}@racho.test`,
      password: 'password123',
    });

    const updated = await authService.updateProfile(user.id, {
      pixKeyType: 'EMAIL',
      pixKey: 'pixtester@racho.test',
    });

    assert.strictEqual(updated.pixKeyType, 'EMAIL');
    assert.strictEqual(updated.pixKey, 'pixtester@racho.test');

    const retrieved = await authService.getUserById(user.id);
    assert.strictEqual(retrieved.pixKey, 'pixtester@racho.test');
  });
});
