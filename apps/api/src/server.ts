import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import dotenv from 'dotenv';

import { authRoutes } from './modules/auth/auth.routes';
import { groupRoutes } from './modules/groups/group.routes';
import { expenseRoutes } from './modules/expenses/expense.routes';
import { balancesRoutes } from './modules/balances/balances.routes';
import { settlementRoutes } from './modules/settlements/settlements.routes';
import { receiptRoutes } from './modules/receipts/receipts.routes';

dotenv.config();

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);

    const configuredOrigins = process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(',').map((o) => o.trim())
      : [];

    const isAllowed =
      configuredOrigins.includes(origin) ||
      /^http:\/\/localhost:\d+$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
      /^https:\/\/.*\.vercel\.app$/.test(origin);

    if (isAllowed) {
      return cb(null, true);
    }

    return cb(new Error('Bloqueado pelas políticas de CORS do Racho API'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

app.register(jwt, {
  secret: process.env.JWT_SECRET || 'racho_secret_key_default',
});

app.register(multipart);

app.get('/health', async () => {
  return { status: 'ok', service: 'racho-api', timestamp: new Date().toISOString() };
});

// Registra módulos da API
app.register(authRoutes, { prefix: '/auth' });
app.register(groupRoutes, { prefix: '/groups' });
app.register(expenseRoutes, { prefix: '/expenses' });
app.register(balancesRoutes, { prefix: '/balances' });
app.register(settlementRoutes, { prefix: '/settlements' });
app.register(receiptRoutes, { prefix: '/receipts' });

const PORT = Number(process.env.PORT) || 3333;
const HOST = process.env.HOST || '0.0.0.0';

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    console.error('Erro ao iniciar o servidor Fastify:', err);
    process.exit(1);
  }
  console.log(`🚀 Servidor Racho API rodando em: ${address}`);
});
