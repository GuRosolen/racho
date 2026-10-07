# 📄 Documento de Especificação Técnica (SDD Phase 2 Addendum)
## Módulo de Liquidação: Geração de Link e Código Pix com Valor Pré-Preenchido

**Projeto:** Racho - Gestão de Despesas & Otimização de Dívidas  
**Versão:** 2.1.0-delta  
**Data:** 07/10/2026  
**Autor:** Engenheiro de Software Sênior  
**Status:** AGUARDANDO_REVISAO  

---

## 1. Contexto & Objetivos

Como o cadastro de Chave Pix (CPF, E-mail, Telefone, Chave Aleatória EVM) já se encontra funcional no perfil do usuário (`User.pixKey` e `User.pixKeyType`), este aditivo ao SDD Phase 2 especifica a arquitetura e a funcionalidade da **Geração de Cobrança Pix Otimizada**, permitindo que dívidas resultantes da simplificação do grafo financeiro (ex: *"Diego deve R$ 35,50 para Shirley"*) sejam quitadas com 1-clique via QR Code/Copia e Cola com valor exato pré-preenchido e link compartilhável via WhatsApp.

---

## 2. Especificação Funcional

### 2.1 Fluxo na Listagem de Saldos e Dívidas (Grafo Otimizado)
Na aba de Saldos/Grafo de Dívidas (`/groups/:groupId`):
1. **Identificação das Transações:** O sistema processa o grafo de dívidas (`balances.simplifiedDebts`) e renderiza os cards de transferência contendo `fromUserId` (devedor), `toUserId` (credor) e `amount` (em centavos inteiros).
2. **Verificação de Chave Pix do Credor:**
   - O sistema consulta os dados do credor (`toUserId`) na lista de membros do grupo.
   - **Se o Credor POSSUIR Chave Pix:**
     - Exibir o botão principal de ação: `[⚡ Pagar via Pix / Ver Cobrança]`.
     - Ao clicar, abre o **Drawer/Modal de Liquidação Pix**.
   - **Se o Credor NÃO POSSUIR Chave Pix:**
     - Exibir aviso informativo no card: *"Credor ainda não cadastrou chave Pix"*.
     - Exibir botão secundário fallback: `[💵 Quitar Manualmente (Dinheiro/TED)]`.

---

### 2.2 Componente Modal/Drawer de Liquidação Pix

Ao abrir o modal de liquidação para uma dívida de valor $V$ (em centavos) de $A$ para $B$:

1. **Geração Dinâmica do Payload BR Code (BACEN / EMV QRCPS-MPM):**
   - **Chave Pix do Credor:** `receiver.pixKey`
   - **Nome do Credor:** `receiver.name` (sanitizado em ASCII maiúsculo)
   - **Cidade do Credor:** `BRASILIA` (padrão fallback BACEN)
   - **Valor Exato:** Formatado de centavos inteiros para string decimal `(amount / 100).toFixed(2)` (ex: `50.33`), garantindo zero erros de ponto flutuante.
   - **Identificador de Transação (txId / Message):** `"Racho - " + group.name` (truncado em 25 caracteres no campo Tag 62 subtag 05).

2. **Exibição & Interações:**
   - **QR Code Renderizado:** Exibição do QR Code estático gerado diretamente na tela com o payload BR Code completo.
   - **Botão "Copiar Código Pix (com valor)":** Copia a string inteira do EMV BR Code para a área de transferência (`navigator.clipboard.writeText`) com feedback visual (ex: ícone de check e mensagem por 2,5 segundos).
   - **Gerador de Link Compartilhável Interno & WhatsApp Web Share API:**
     - Geração da URL interna compartilhável: `/groups/:groupId/pay?to=:receiverId&amount=:amountCents`.
     - Botão `[📲 Compartilhar Cobrança via WhatsApp]` acionando a Web Share API (`navigator.share`) com fallback para WhatsApp Deep Link (`https://wa.me/?text=...`).
     - Mensagem formatada predefinida:
       > *"Olá! Aqui está o link para pagamento do nosso racha no Racho (Grupo: {GroupName}): R$ {ValorFormatted}. Chave Pix: {PixKey}. Copie o código ou abra: {PayLink}"*

3. **Ação Pós-Pagamento ("Confirmar Pagamento / Marcar como Quitado"):**
   - Botão em destaque `[✅ Confirmar Pagamento / Marcar como Quitado]`.
   - Ao ser clicado:
     - Dispara requisição `POST /settlements` contendo `{ groupId, receiverId, amount, currency, note }`.
     - Executa a transação no banco de dados, registra o `AuditLog` com a ação `CREATE_SETTLEMENT`.
     - Fecha o modal, invalida o cache/estado dos saldos e atualiza o grafo de dívidas em tempo real.

---

## 3. Especificação do Utilitário Pix (BR Code / EMV TLV)

A montagem do payload estático segue estritamente a especificação **EMV QRCPS-MPM (BACEN / BR Code)** implementada em TypeScript nativo em `packages/shared/src/utils/pix.ts`, sem dependência de serviços externos de terceiros para garantir resiliência e baixíssima latência.

### 3.1 Estrutura de Tags EMV TLV (Type-Length-Value)

| Tag EMV | Descrição | Conteúdo / Regra de Formatação | Exemplo |
| :--- | :--- | :--- | :--- |
| **`00`** | Payload Format Indicator | Fixo `01` | `000201` |
| **`01`** | Point of Initiation Method | Fixo `12` (Estático com valor pré-preenchido) | `010212` |
| **`26`** | Merchant Account Information | Subtag `00` (`br.gov.bcb.pix`) + Subtag `01` (`pixKey`) | `26350014br.gov.bcb.pix0113user@pix.com` |
| **`52`** | Merchant Category Code | Fixo `0000` | `52040000` |
| **`53`** | Transaction Currency | Fixo `986` (BRL ISO 4217) | `5303986` |
| **`54`** | Transaction Amount | Formatado em reais com 2 casas decimais a partir dos centavos inteiros | `540550.33` |
| **`58`** | Country Code | Fixo `BR` | `5802BR` |
| **`59`** | Merchant Name | Nome do Credor (Upper ASCII, NFD sem acentos, max 25 chars) | `5915SHIRLEY ROSOLEN` |
| **`60`** | Merchant City | Cidade do Credor (Upper ASCII, NFD sem acentos, max 15 chars) | `6008BRASILIA` |
| **`62`** | Additional Data Field | Subtag `05` (`txId` / Identificador da transação, max 25 chars) | `62180514RACHO-VIAGEM` |
| **`63`** | CRC16 Checksum | Tag `63` + Tamanho `04` + Hexadecimal de 4 dígitos (CCITT 0x1021) | `6304A1B2` |

### 3.2 Tratamento de Sanitização e Cálculo CRC16

```typescript
// Sanitização de Nome/Cidade (Remoção de diacríticos e caracteres não-ASCII)
const cleanName = merchantName
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9 ]/g, '')
  .trim()
  .slice(0, 25)
  .toUpperCase();

// Cálculo de CRC16-CCITT (Polinômio 0x1021, valor inicial 0xFFFF)
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
```

---

## 4. Contratos de API & DTOs

### 4.1 Segurança & Isolamento de Dados do Credor
A chave Pix do credor **nunca deve ser exposta publicamente** para usuários anônimos ou membros de outros grupos. 
- A consulta aos dados do credor exige autenticação JWT válida (`authenticate` middleware).
- A API valida se o usuário solicitante (`request.user.sub`) compartilha a mesma associação de grupo (`GroupMember`) com o credor.

### 4.2 Endpoint / Actions Envolvidas

#### 1. Consulta de Detalhes do Grupo e Chaves Pix dos Membros
- **HTTP:** `GET /groups/:groupId`
- **Headers:** `Authorization: Bearer <token>`
- **Resposta DTO:**
```typescript
export interface GroupMemberResponse {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  pixKey: string | null;      // Apenas retornado para membros autenticados do grupo
  pixKeyType: 'CPF' | 'EMAIL' | 'PHONE' | 'RANDOM' | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}
```

#### 2. Registro de Liquidação (Settlement)
- **HTTP:** `POST /settlements`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body (Zod DTO):**
```typescript
export const createSettlementSchema = z.object({
  groupId: z.string().uuid(),
  receiverId: z.string().uuid('ID do credor inválido'),
  amount: z.number().int().positive('O valor da liquidação deve ser positivo em centavos'),
  currency: z.enum(['BRL', 'USD', 'EUR', 'GBP']).default('BRL'),
  note: z.string().optional(),
});
```
- **HTTP Status Codes:**
  - `201 Created`: Liquidação persistida com sucesso e saldo abatido.
  - `403 Forbidden`: Usuário não é membro do grupo.
  - `400 Bad Request`: Dados inválidos ou ID de credor inexistente.

---

## 5. Matriz de Testes e Casos de Uso (Given / When / Then)

| ID | Caso de Uso / Cenário | Dado que (Given) | Quando (When) | Então (Then) |
| :--- | :--- | :--- | :--- | :--- |
| **UC-SETTLE-01** | **Geração de Payload Pix com Valor Pré-Preenchido Exato** | Existe uma dívida de **R$ 50,33** (`5033` centavos) onde o credor possui a chave Pix `shirley@racho.app` cadastrada. | O usuário clica em "Pagar via Pix / Ver Cobrança". | O payload BR Code gerado contém a subtag de valor `540550.33`, a chave `shirley@racho.app`, o nome sanitizado do credor e o checksum CRC16 final válido (4 caracteres hexadecimais). |
| **UC-SETTLE-02** | **Tratamento de Credor Sem Chave Pix Cadastrada** | O credor `Diego` não possui chave Pix cadastrada (`pixKey === null`). | O usuário visualiza o card da dívida no grafo de saldos. | O sistema exibe o alerta informando *"Credor ainda não cadastrou chave Pix"*, oculta o QR Code automático e apresenta opção de acerto manual / lembrete. |
| **UC-SETTLE-03** | **Cópia do Código Pix Copia e Cola para Clipboard** | O modal de liquidação Pix está aberto exibindo o QR Code e o botão "Copiar Código Pix (com valor)". | O usuário clica no botão de cópia. | O código EMV BR Code completo é gravado no `navigator.clipboard`, o estado visual muda para "Copiado com Sucesso!" por 2,5s e nenhum erro de cópia ocorre. |
| **UC-SETTLE-04** | **Compartilhamento de Link de Cobrança via WhatsApp** | O modal de liquidação Pix está sendo exibido para uma dívida de R$ 120,00 no grupo "Viagem". | O usuário clica em "Compartilhar Cobrança via WhatsApp". | A Web Share API ou a URL `https://wa.me/?text=...` é disparada com o texto preenchido contendo o valor formatado, chave Pix e link direto para acerto no Racho. |
| **UC-SETTLE-05** | **Efetivação da Liquidação no Banco de Dados** | O devedor concluiu a transferência Pix no app do banco e clica em "Confirmar Pagamento / Marcar como Quitado". | A requisição `POST /settlements` é executada com `{ groupId, receiverId, amount: 5033 }`. | A transação cria o registro em `Settlement`, gera log em `AuditLog`, zera/abate o saldo no grafo de dívidas e atualiza a interface em tempo real. |

---

## 6. Próximos Passos (Aguardando Aprovação)

Após a sua revisão e homologação deste Documento de Especificação Técnica:
1. Procederemos com a atualização/revisão dos componentes visuais do Next.js 14 (`apps/web/src/app/groups/[id]/page.tsx` e subcomponentes).
2. Validação dos testes automatizados de backend e frontend (`pnpm test`).
