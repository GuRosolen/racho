import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { registerSchema, loginSchema } from '@racho/shared';
import { AuthService } from './auth.service';
import { authenticate } from '../../shared/middlewares/authenticate';

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService();
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // POST /auth/register
  typedApp.post('/register', { schema: { body: registerSchema } }, async (request, reply) => {
    try {
      const user = await authService.register(request.body);
      const token = app.jwt.sign({ sub: user.id, email: user.email, name: user.name });

      return reply.status(201).send({ user, accessToken: token });
    } catch (err: any) {
      return reply.status(400).send({ message: err.message || 'Erro ao realizar cadastro' });
    }
  });

  // POST /auth/login
  typedApp.post('/login', { schema: { body: loginSchema } }, async (request, reply) => {
    try {
      const user = await authService.login(request.body);
      const token = app.jwt.sign({ sub: user.id, email: user.email, name: user.name });

      return reply.send({ user, accessToken: token });
    } catch (err: any) {
      return reply.status(401).send({ message: err.message || 'E-mail ou senha incorretos' });
    }
  });

  // GET /auth/me
  typedApp.get('/me', { onRequest: [authenticate] }, async (request, reply) => {
    const userId = request.user.sub;
    try {
      const user = await authService.getUserById(userId);
      return reply.send({ user });
    } catch (err: any) {
      return reply.status(404).send({ message: err.message });
    }
  });
}
