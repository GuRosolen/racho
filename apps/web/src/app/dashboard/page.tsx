'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { fetchApi } from '@/lib/api';
import { Plus, Users, ArrowRight, LogOut, Wallet, UserPlus, QrCode } from 'lucide-react';

interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  inviteCode: string;
  role: string;
  _count: { members: number; expenses: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, updateUser, logout } = useAuthStore();

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Modal Entrar via Convite
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinInput, setJoinInput] = useState('');

  // Modal de Perfil & Chave Pix
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [pixKeyType, setPixKeyType] = useState<'CPF' | 'EMAIL' | 'PHONE' | 'RANDOM'>('CPF');
  const [pixKey, setPixKey] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const openProfileModal = () => {
    if (user) {
      setProfileName(user.name || '');
      setPixKeyType((user.pixKeyType as any) || 'CPF');
      setPixKey(user.pixKey || '');
    }
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSavingProfile(true);
    try {
      const res = await fetchApi<{ user: any }>('/auth/profile', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          name: profileName.trim(),
          pixKeyType,
          pixKey: pixKey.trim(),
        }),
      });

      updateUser(res.user);
      setShowProfileModal(false);
      alert('Perfil e chave Pix atualizados com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    async function loadGroups() {
      try {
        const res = await fetchApi<{ groups: GroupSummary[] }>('/groups', { token: token! });
        setGroups(res.groups);
      } catch (err) {
        console.error('Erro ao carregar grupos:', err);
      } finally {
        setLoading(false);
      }
    }

    loadGroups();
  }, [token, router]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !token) return;

    setCreating(true);
    try {
      const res = await fetchApi<{ group: any }>('/groups', {
        method: 'POST',
        token,
        body: JSON.stringify({ name: newGroupName, description: newGroupDesc }),
      });

      setShowCreateModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
      router.push(`/groups/${res.group.id}`);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar grupo');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInput.trim()) return;

    let code = joinInput.trim();
    if (code.includes('/join/')) {
      code = code.split('/join/')[1].split('?')[0].split('/')[0];
    }

    setShowJoinModal(false);
    setJoinInput('');
    router.push(`/join/${code}`);
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-gray-100">
      {/* Header / Nav */}
      <header className="border-b border-gray-800 bg-[#131926]/60 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
              R
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Racho<span className="text-emerald-500">.</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openProfileModal}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition"
              title="Configurar chave Pix do seu perfil"
            >
              <QrCode className="h-4 w-4" />
              <span>Chave Pix</span>
            </button>

            <span className="text-sm font-medium text-gray-300 hidden sm:inline">
              Olá, <strong className="text-white">{user?.name || 'Usuário'}</strong>
            </span>

            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-gray-800"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Seus Grupos</h1>
            <p className="mt-1 text-sm text-gray-400">
              Gerencie despesas compartilhadas e acompanhe saldos
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-2.5 font-semibold text-gray-200 transition hover:bg-gray-800"
            >
              <UserPlus className="h-4 w-4 text-emerald-400" /> Entrar via Código
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500"
            >
              <Plus className="h-5 w-5" /> Novo Grupo
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex py-20 justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-800 bg-[#131926]/40 p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">Nenhum grupo encontrado</h3>
            <p className="mt-1 text-sm text-gray-400 max-w-md mx-auto">
              Você ainda não participa de nenhum grupo de despesas. Crie um grupo para começar a rachar contas com amigos.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" /> Criar Meu Primeiro Grupo
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <div
                key={group.id}
                onClick={() => router.push(`/groups/${group.id}`)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-gray-800 bg-[#131926]/80 p-6 shadow-xl backdrop-blur-xl transition hover:border-emerald-500/50 hover:shadow-emerald-500/10"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-lg border border-emerald-500/20">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-300">
                    {group.currency}
                  </span>
                </div>

                <h3 className="mt-4 text-xl font-bold text-white group-hover:text-emerald-400 transition">
                  {group.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                  {group.description || 'Sem descrição'}
                </p>

                <div className="mt-6 flex items-center justify-between border-t border-gray-800/80 pt-4 text-xs text-gray-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-emerald-400" /> {group._count.members} membros
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Wallet className="h-4 w-4 text-emerald-400" /> {group._count.expenses} despesas
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Criar Grupo */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#131926] p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white">Criar Novo Grupo</h2>
            <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400">
                  Nome do Grupo
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="Ex: Viagem de Fim de Ano"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="Despesas da viagem para a praia..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Entrar via Código de Convite */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#131926] p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white">Entrar em um Grupo</h3>
            <p className="mt-1 text-xs text-gray-400">
              Cole o link completo de convite ou apenas o código que recebeu de um amigo
            </p>

            <form onSubmit={handleJoinSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400">
                  Link ou Código de Convite
                </label>
                <input
                  type="text"
                  required
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                  placeholder="Ex: https://racho.app/join/xyz ou apenas o código"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition"
                >
                  Continuar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Meu Perfil & Configurar Chave Pix */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#131926] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-400" /> Meu Perfil & Chave Pix
              </h3>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400">
                  Tipo de Chave Pix
                </label>
                <select
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value as any)}
                  className="mt-1.5 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none text-sm"
                >
                  <option value="CPF">CPF / CNPJ</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="PHONE">Telefone</option>
                  <option value="RANDOM">Chave Aleatória (EVP / UUID)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400">
                  Chave Pix
                </label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none placeholder-gray-600"
                  placeholder={
                    pixKeyType === 'CPF'
                      ? '000.000.000-00'
                      : pixKeyType === 'EMAIL'
                      ? 'suachave@email.com'
                      : pixKeyType === 'PHONE'
                      ? '+5511999999999'
                      : 'uuid-aleatorio-pix'
                  }
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Sua chave Pix permite que outros membros quitem dívidas diretamente pelo app.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition shadow-lg shadow-emerald-600/20"
                >
                  {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
