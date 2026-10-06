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

  // Sanitizar nome e cidade para ASCII sem acentos
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

  const amountStr = (amountCents / 100).toFixed(2);

  // Merchant Account Info (Tag 26)
  const gui = emvField('00', 'br.gov.bcb.pix');
  const key = emvField('01', pixKey.trim());
  const merchantAccountInfo = emvField('26', `${gui}${key}`);

  // Additional Data Field Template (Tag 62)
  const txField = emvField('05', txId.slice(0, 25));
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
