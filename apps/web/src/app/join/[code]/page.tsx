'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { fetchApi } from '@/lib/api';
import { GroupInvitePreview } from '@racho/shared';
import { Users, ArrowRight, ShieldCheck, AlertCircle, LogIn, UserPlus } from 'lucide-react';

export default function JoinGroupPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const inviteCode = resolvedParams.code;

  const router = useRouter();
  const { user, token } = useAuthStore();

  const [group, setGroup] = useState<GroupInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function loadGroupPreview() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchApi<{ group: GroupInvitePreview }>(`/groups/invite/${inviteCode}`);
        setGroup(res.group);
      } catch (err: any) {
        setError(err.message || 'Código de convite inválido ou expirado');
      } finally {
        setLoading(false);
      }
    }

    loadGroupPreview();
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!token) {
      router.push(`/login?returnUrl=/join/${inviteCode}`);
      return;
    }

    try {
      setJoining(true);
      const res = await fetchApi<{ group: { id: string } }>('/groups/join', {
        method: 'POST',
        token,
        body: JSON.stringify({ inviteCode }),
      });

      router.push(`/groups/${res.group.id}`);
    } catch (err: any) {
      alert(err.message || 'Erro ao ingressar no grupo');
      setJoining(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[#0b0f17]">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-gray-800 bg-[#131926]/90 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
            <Users className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-white">Convite para Grupo</h1>
          <p className="mt-1 text-sm text-gray-400">
            Você foi convidado a dividir despesas no <strong className="text-emerald-400 font-semibold">Racho</strong>
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <span className="text-xs text-gray-400">Verificando convite...</span>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Convite não encontrado</p>
                <p className="text-xs text-red-400/80 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={() => router.push(token ? '/dashboard' : '/login')}
              className="w-full rounded-xl border border-gray-700 bg-gray-900/80 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-800 transition"
            >
              Ir para o Início
            </button>
          </div>
        ) : group ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  {group.currency}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-gray-500" />
                  {group.memberCount} {group.memberCount === 1 ? 'membro' : 'membros'}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">{group.name}</h2>
                {group.description && (
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">{group.description}</p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-800/80 flex items-center gap-2 text-xs text-gray-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Divisão justa calculada em centavos sem dízimas</span>
              </div>
            </div>

            {token ? (
              <div className="space-y-3">
                <div className="text-xs text-gray-400 text-center">
                  Entrando como <strong className="text-white">{user?.name}</strong> ({user?.email})
                </div>
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 font-semibold text-white transition hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {joining ? (
                    'Entrando no grupo...'
                  ) : (
                    <>
                      Confirmar e Entrar no Grupo <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 text-center">
                  Entre ou crie sua conta para participar deste grupo
                </p>
                <button
                  onClick={() => router.push(`/login?returnUrl=/join/${inviteCode}`)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
                >
                  <LogIn className="h-4 w-4" /> Fazer Login para Entrar
                </button>
                <button
                  onClick={() => router.push(`/register?returnUrl=/join/${inviteCode}`)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-900/60 py-3 font-semibold text-gray-300 transition hover:bg-gray-800"
                >
                  <UserPlus className="h-4 w-4" /> Criar Nova Conta
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
