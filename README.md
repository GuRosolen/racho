# 🚀 Racho - Gestão de Despesas & Otimização de Dívidas

Plataforma fullstack em monorepo para gestão de despesas compartilhadas, divisão inteligente de contas com precisão financeira em centavos, escaneamento de cupom fiscal com IA Multimodal e simplificação algorítmica de dívidas.

---

## 🛠️ Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Backend:** Node.js, Fastify, TypeScript (`strict: true`), Zod
- **Banco de Dados & ORM:** Prisma ORM com SQLite (desenvolvimento) e PostgreSQL (produção)
- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons, Zustand
- **Precisão Financeira:** Valores manipulados estritamente em **centavos inteiros** (sem ponto flutuante)

---

## 📁 Estrutura do Monorepo

```text
racho/
├── apps/
│   ├── api/        # Servidor Fastify API (Auth, Groups, Expenses, OCR, Debt Graph)
│   └── web/        # Aplicação Next.js 14 (App Router, Tailwind UI)
├── packages/
│   ├── shared/     # Schemas Zod e Utilitários Financeiros em Centavos
│   ├── db/         # Prisma Schema e Seeders
│   └── tsconfig/   # Configurações TypeScript reutilizáveis
```

---

## ⚡ Como Rodar Localmente

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/SEU_USUARIO/racho.git
   cd racho
   ```

2. **Instalar dependências:**
   ```bash
   pnpm install
   ```

3. **Gerar o Prisma Client e Criar o Banco Local:**
   ```bash
   pnpm --filter @racho/db run db:push
   pnpm --filter @racho/db run db:seed
   ```

4. **Iniciar o Servidor de Desenvolvimento:**
   ```bash
   pnpm dev
   ```

- **Frontend:** [http://127.0.0.1:3000](http://127.0.0.1:3000)
- **API Backend:** [http://127.0.0.1:3333/health](http://127.0.0.1:3333/health)

---

## 🧪 Testes Unitários

```bash
pnpm --filter @racho/shared test
```
