export interface PixPayloadParams {
  pixKey: string;
  merchantName: string;
  merchantCity?: string;
  amountCents: number; // Valor em centavos
  txId?: string; // Identificador da transação
}

function emvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Algoritmo CRC16-CCITT (Polinômio 0x1021, valor inicial 0xFFFF)
 */
function calculateCRC16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gerador de Payload Pix Copia e Cola no Padrão BACEN / EMV BR Code (QRCPS-MPM)
 */
export function generatePixPayload(params: PixPayloadParams): string {
  const { pixKey, merchantName, merchantCity = 'BRASILIA', amountCents, txId = '***' } = params;

  // Sanitizar Chave Pix (Tag 26.01): Se for CPF, manter estritamente apenas os 11 dígitos numéricos
  let cleanKey = pixKey.trim();
  const rawDigits = cleanKey.replace(/\D/g, '');
  if (rawDigits.length === 11 && !cleanKey.includes('@')) {
    cleanKey = rawDigits;
  }

  // Sanitizar nome e cidade para ASCII sem acentos (Tags 59 e 60)
  const cleanName = (merchantName || 'MEMBRO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, 25)
    .toUpperCase();

  const cleanCity = (merchantCity || 'BRASILIA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, 15)
    .toUpperCase();

  // Sanitizar txId (Tag 62.05): Padrão BACEN exige ESTRITAMENTE alfanumérico [a-zA-Z0-9] sem espaços, traços ou símbolos.
  // Se o txId for nulo, vazio ou inválido após sanitização, utiliza o fallback oficial '***'.
  let cleanTx = (txId || '***')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '') // Remove hífens, espaços e símbolos
    .slice(0, 25);

  if (!cleanTx || cleanTx.length === 0) {
    cleanTx = '***';
  }

  const amountStr = (amountCents / 100).toFixed(2);

  // Merchant Account Info (Tag 26)
  const gui = emvField('00', 'br.gov.bcb.pix');
  const key = emvField('01', cleanKey);
  const merchantAccountInfo = emvField('26', `${gui}${key}`);

  // Additional Data Field Template (Tag 62)
  const txField = emvField('05', cleanTx);
  const additionalData = emvField('62', txField);

  // String base do payload EMV antes do CRC16
  const payloadWithoutCrc =
    emvField('00', '01') + // Payload Format Indicator
    emvField('01', '12') + // Point of Initiation Method (12 = Estático com valor fixo)
    merchantAccountInfo +
    emvField('52', '0000') + // Merchant Category Code
    emvField('53', '986') + // Currency (986 = BRL)
    emvField('54', amountStr) + // Transaction Amount
    emvField('58', 'BR') + // Country Code
    emvField('59', cleanName) + // Merchant Name
    emvField('60', cleanCity) + // Merchant City
    additionalData +
    '6304'; // Tag CRC16 + tamanho (04)

  const crcHex = calculateCRC16(payloadWithoutCrc);
  return `${payloadWithoutCrc}${crcHex}`;
}
