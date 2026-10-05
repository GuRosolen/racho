/**
 * Utilitários para Manipulação Financeira Estrita em Inteiros (Centavos) - RNF01
 */

/**
 * Converte valor em reais (ex: 15.50 ou "15,50") para centavos inteiros (1550).
 */
export function toCents(amountInUnits: number | string): number {
  if (typeof amountInUnits === 'string') {
    const sanitized = amountInUnits.replace(',', '.').trim();
    const parsed = parseFloat(sanitized);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  }
  return Math.round(amountInUnits * 100);
}

/**
 * Formata um valor em centavos (ex: 1550) para string de exibição BRL (ex: "R$ 15,50").
 */
export function formatCentsToCurrency(cents: number, currency: string = 'BRL'): string {
  const units = cents / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(units);
}

/**
 * Realiza a divisão igualitária de um valor em centavos entre N participantes,
 * atribuindo deterministicamente qualquer resto da divisão (dízimo de centavos) aos primeiros participantes.
 * Garantia: sum(cotas) === totalAmountCents
 */
export function distributeEqualCents(
  totalAmountCents: number,
  participantIds: string[]
): Map<string, number> {
  const count = participantIds.length;
  if (count === 0) return new Map();

  const baseShare = Math.floor(totalAmountCents / count);
  let remainder = totalAmountCents - baseShare * count;

  const result = new Map<string, number>();

  for (const id of participantIds) {
    let share = baseShare;
    if (remainder > 0) {
      share += 1;
      remainder -= 1;
    }
    result.set(id, share);
  }

  return result;
}

/**
 * Rateio pro-rata de taxas adicionais (serviço, frete) em centavos com base no subtotal individual.
 * Garantia: sum(cotas) === totalTaxCents
 */
export function distributeProRataCents(
  totalTaxCents: number,
  subtotalsByParticipant: Map<string, number>
): Map<string, number> {
  const totalSubtotal = Array.from(subtotalsByParticipant.values()).reduce(
    (acc, val) => acc + val,
    0
  );

  const result = new Map<string, number>();
  if (totalSubtotal <= 0 || totalTaxCents <= 0) {
    for (const [id] of subtotalsByParticipant) {
      result.set(id, 0);
    }
    return result;
  }

  let distributedTaxSum = 0;
  const entries = Array.from(subtotalsByParticipant.entries());

  for (const [id, subtotal] of entries) {
    const rawTax = Math.floor((totalTaxCents * subtotal) / totalSubtotal);
    result.set(id, rawTax);
    distributedTaxSum += rawTax;
  }

  // Ajuste do resto de centavos no primeiro participante de maior subtotal
  let remainder = totalTaxCents - distributedTaxSum;
  entries.sort((a, b) => b[1] - a[1]);

  for (const [id] of entries) {
    if (remainder <= 0) break;
    result.set(id, (result.get(id) || 0) + 1);
    remainder -= 1;
  }

  return result;
}
