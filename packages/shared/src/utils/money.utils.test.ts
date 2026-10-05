import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  toCents,
  formatCentsToCurrency,
  distributeEqualCents,
  distributeProRataCents,
} from './money.utils';

describe('Utilitários Financeiros em Centavos (money.utils)', () => {
  it('deve converter corretamente valores em reais para centavos inteiros', () => {
    assert.strictEqual(toCents(100), 10000);
    assert.strictEqual(toCents(15.5), 1550);
    assert.strictEqual(toCents('33,33'), 3333);
    assert.strictEqual(toCents('100.00'), 10000);
  });

  it('deve formatar centavos para moeda BRL', () => {
    const formatted = formatCentsToCurrency(1550, 'BRL');
    assert.ok(formatted.includes('15,50'));
  });

  it('deve distribuir 10000 centavos entre 3 pessoas sem perder centavos (UC01)', () => {
    const participants = ['userA', 'userB', 'userC'];
    const result = distributeEqualCents(10000, participants);

    assert.strictEqual(result.get('userA'), 3334); // Sobra de 1 centavo atribuída ao primeiro
    assert.strictEqual(result.get('userB'), 3333);
    assert.strictEqual(result.get('userC'), 3333);

    const sum = Array.from(result.values()).reduce((a, b) => a + b, 0);
    assert.strictEqual(sum, 10000);
  });

  it('deve calcular o rateio pro-rata da taxa de serviço de nota fiscal em centavos (UC05)', () => {
    const subtotals = new Map<string, number>([
      ['userA', 3000], // R$ 30,00
      ['userB', 4000], // R$ 40,00
      ['userC', 3000], // R$ 30,00
    ]);

    const totalTaxCents = 1000; // Gorjeta R$ 10,00
    const taxes = distributeProRataCents(totalTaxCents, subtotals);

    assert.strictEqual(taxes.get('userA'), 300); // R$ 3,00
    assert.strictEqual(taxes.get('userB'), 400); // R$ 4,00
    assert.strictEqual(taxes.get('userC'), 300); // R$ 3,00

    const sumTax = Array.from(taxes.values()).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumTax, 1000);
  });
});
