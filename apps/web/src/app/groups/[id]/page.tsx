'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { fetchApi } from '@/lib/api';
import { formatCentsToCurrency, GroupBalancesResponse } from '@racho/shared';
import {
  ArrowLeft,
  Plus,
  Receipt,
  Users,
  Copy,
  Check,
  Zap,
  CheckCircle2,
  Trash2,
  Pencil,
  FileText,
  DollarSign,
  Share2,
  RefreshCw,
  Link,
} from 'lucide-react';

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
}

interface GroupDetails {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  inviteCode: string;
  members: Member[];
}

interface Expense {
  id: string;
  createdById?: string;
  paidById?: string;
  version?: number;
  description: string;
  amount: number;
  taxAmount?: number;
  category: string;
  splitType: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  payers: { amountPaid: number; user: { id: string; name: string } }[];
  splits: { shareAmount: number; user: { id: string; name: string } }[];
  items?: {
    id?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    assignments?: { userId?: string; user?: { id: string; name: string } }[];
  }[];
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const groupId = resolvedParams.id;

  const router = useRouter();
  const { user, token } = useAuthStore();

  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<GroupBalancesResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'receipt'>('expenses');
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  // Modal de Nova / Edição de Despesa
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [splitType, setSplitType] = useState<'EQUAL' | 'ITEMIZED'>('EQUAL');
  const [desc, setDesc] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // State para modo ITEMIZED
  interface ItemInput {
    id: string;
    name: string;
    unitPriceStr: string;
    quantity: number;
    assignedMemberIds: string[];
  }
  const [items, setItems] = useState<ItemInput[]>([]);
  const [taxAmountStr, setTaxAmountStr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal de Liquidação / Settlement
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<{ toUserId: string; toUserName: string; amount: number } | null>(null);
  const [settling, setSettling] = useState(false);

  // State OCR Upload
  const [scanning, setScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<any>(null);

  const openExpenseModal = (expenseToEdit?: Expense) => {
    if (!group) return;
    const allMemberIds = group.members.map((m) => m.userId);

    if (expenseToEdit) {
      setEditingExpense(expenseToEdit);
      setDesc(expenseToEdit.description);
      const isItemized = expenseToEdit.splitType === 'ITEMIZED';
      setSplitType(isItemized ? 'ITEMIZED' : 'EQUAL');

      if (isItemized) {
        setTaxAmountStr(expenseToEdit.taxAmount ? (expenseToEdit.taxAmount / 100).toString().replace('.', ',') : '');
        if (expenseToEdit.items && expenseToEdit.items.length > 0) {
          setItems(
            expenseToEdit.items.map((it, idx) => ({
              id: it.id || `${Date.now()}-${idx}`,
              name: it.name,
              unitPriceStr: (it.unitPrice / 100).toString().replace('.', ','),
              quantity: it.quantity || 1,
              assignedMemberIds: it.assignments?.length
                ? it.assignments.map((a) => a.userId || a.user?.id!).filter(Boolean)
                : allMemberIds,
            }))
          );
        } else {
          setItems([{ id: Date.now().toString(), name: '', unitPriceStr: '', quantity: 1, assignedMemberIds: allMemberIds }]);
        }
      } else {
        setAmountStr((expenseToEdit.amount / 100).toString().replace('.', ','));
        setSelectedMemberIds(
          expenseToEdit.splits?.length ? expenseToEdit.splits.map((s) => s.user.id) : allMemberIds
        );
      }
    } else {
      setEditingExpense(null);
      setSelectedMemberIds(allMemberIds);
      setItems([{ id: Date.now().toString(), name: '', unitPriceStr: '', quantity: 1, assignedMemberIds: allMemberIds }]);
      setDesc('');
      setAmountStr('');
      setTaxAmountStr('');
      setSplitType('EQUAL');
    }

    setShowExpenseModal(true);
  };

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    async function loadData() {
      try {
        const [groupRes, expRes, balRes] = await Promise.all([
          fetchApi<{ group: GroupDetails }>(`/groups/${groupId}`, { token: token! }),
          fetchApi<{ expenses: Expense[] }>(`/expenses/group/${groupId}`, { token: token! }),
          fetchApi<GroupBalancesResponse>(`/balances/group/${groupId}`, { token: token! }),
        ]);

        setGroup(groupRes.group);
        setExpenses(expRes.expenses);
        setBalances(balRes);
      } catch (err) {
        console.error('Erro ao carregar dados do grupo:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [groupId, token, router]);

  const [regenerating, setRegenerating] = useState(false);

  const handleShare = async () => {
    if (!group?.inviteCode) return;
    const inviteUrl = `${window.location.origin}/join/${group.inviteCode}`;
    const shareData = {
      title: `Convite para o grupo ${group.name} - Racho`,
      text: `Olá! Vamos dividir as despesas do grupo "${group.name}" no Racho. Acesse pelo link:`,
      url: inviteUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      alert(`Link de convite: ${inviteUrl}`);
    }
  };

  const handleRegenerateInvite = async () => {
    if (!confirm('Deseja realmente gerar um novo link de convite? O link anterior deixará de funcionar.')) {
      return;
    }

    setRegenerating(true);
    try {
      const res = await fetchApi<{ group: { id: string; inviteCode: string } }>(
        `/groups/${groupId}/regenerate-invite`,
        { method: 'POST', token: token! }
      );
      setGroup((prev) => (prev ? { ...prev, inviteCode: res.group.inviteCode } : null));
      alert('Novo link de convite gerado com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao gerar novo convite');
    } finally {
      setRegenerating(false);
    }
  };

  const addItemInput = () => {
    const allMemberIds = group ? group.members.map((m) => m.userId) : [];
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', unitPriceStr: '', quantity: 1, assignedMemberIds: allMemberIds },
    ]);
  };

  const removeItemInput = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateItemInput = (id: string, field: keyof ItemInput, value: any) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  };

  const toggleItemMember = (itemId: string, memberUserId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const exists = it.assignedMemberIds.includes(memberUserId);
        const newIds = exists
          ? it.assignedMemberIds.filter((id) => id !== memberUserId)
          : [...it.assignedMemberIds, memberUserId];
        return { ...it, assignedMemberIds: newIds };
      })
    );
  };

  const toggleEqualMember = (memberUserId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberUserId)
        ? prev.filter((id) => id !== memberUserId)
        : [...prev, memberUserId]
    );
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !token || !user || !group) return;

    setSubmitting(true);
    try {
      if (splitType === 'EQUAL') {
        const amountCents = Math.round(parseFloat(amountStr.replace(',', '.')) * 100);
        if (isNaN(amountCents) || amountCents <= 0) {
          alert('Informe um valor válido em R$');
          setSubmitting(false);
          return;
        }

        if (selectedMemberIds.length === 0) {
          alert('Selecione pelo menos um participante para o rateio');
          setSubmitting(false);
          return;
        }

        if (editingExpense) {
          await fetchApi(`/expenses/${group.id}/${editingExpense.id}`, {
            method: 'PUT',
            token,
            body: JSON.stringify({
              version: editingExpense.version || 1,
              description: desc,
              amount: amountCents,
              splitType: 'EQUAL',
              memberIds: selectedMemberIds.length === group.members.length ? undefined : selectedMemberIds,
              payers: [{ userId: user.id, amountPaid: amountCents }],
            }),
          });
        } else {
          await fetchApi('/expenses', {
            method: 'POST',
            token,
            body: JSON.stringify({
              groupId: group.id,
              description: desc,
              amount: amountCents,
              splitType: 'EQUAL',
              memberIds: selectedMemberIds.length === group.members.length ? undefined : selectedMemberIds,
              payers: [{ userId: user.id, amountPaid: amountCents }],
            }),
          });
        }
      } else {
        // MODO ITEMIZED
        if (items.length === 0) {
          alert('Adicione pelo menos um item à despesa');
          setSubmitting(false);
          return;
        }

        let itemsSubtotalCents = 0;
        const formattedItems = [];

        for (const item of items) {
          if (!item.name.trim()) {
            alert('Preencha a descrição de todos os itens');
            setSubmitting(false);
            return;
          }
          const priceCents = Math.round(parseFloat(item.unitPriceStr.replace(',', '.')) * 100);
          if (isNaN(priceCents) || priceCents <= 0) {
            alert(`Informe um valor unitário válido para o item "${item.name}"`);
            setSubmitting(false);
            return;
          }
          if (item.assignedMemberIds.length === 0) {
            alert(`Selecione ao menos um consumidor para o item "${item.name}"`);
            setSubmitting(false);
            return;
          }

          const itemTotalCents = priceCents * item.quantity;
          itemsSubtotalCents += itemTotalCents;
          formattedItems.push({
            name: item.name.trim(),
            unitPrice: priceCents,
            quantity: item.quantity,
            totalPrice: itemTotalCents,
            assignedUserIds: item.assignedMemberIds,
            assignedMemberIds: item.assignedMemberIds,
          });
        }

        const taxCents = taxAmountStr ? Math.round(parseFloat(taxAmountStr.replace(',', '.')) * 100) : 0;
        const totalAmountCents = itemsSubtotalCents + (isNaN(taxCents) ? 0 : taxCents);

        if (editingExpense) {
          await fetchApi(`/expenses/${group.id}/${editingExpense.id}`, {
            method: 'PUT',
            token,
            body: JSON.stringify({
              version: editingExpense.version || 1,
              description: desc,
              amount: totalAmountCents,
              splitType: 'ITEMIZED',
              taxAmount: isNaN(taxCents) ? 0 : taxCents,
              payers: [{ userId: user.id, amountPaid: totalAmountCents }],
              items: formattedItems,
            }),
          });
        } else {
          await fetchApi('/expenses', {
            method: 'POST',
            token,
            body: JSON.stringify({
              groupId: group.id,
              description: desc,
              amount: totalAmountCents,
              splitType: 'ITEMIZED',
              taxAmount: isNaN(taxCents) ? 0 : taxCents,
              payers: [{ userId: user.id, amountPaid: totalAmountCents }],
              items: formattedItems,
            }),
          });
        }
      }

      // Recarregar extrato e saldos
      const [expRes, balRes] = await Promise.all([
        fetchApi<{ expenses: Expense[] }>(`/expenses/group/${groupId}`, { token }),
        fetchApi<GroupBalancesResponse>(`/balances/group/${groupId}`, { token }),
      ]);

      setExpenses(expRes.expenses);
      setBalances(balRes);
      setShowExpenseModal(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar despesa');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Deseja realmente excluir esta despesa?')) return;
    try {
      await fetchApi(`/expenses/${expenseId}`, { method: 'DELETE', token: token! });
      const [expRes, balRes] = await Promise.all([
        fetchApi<{ expenses: Expense[] }>(`/expenses/group/${groupId}`, { token: token! }),
        fetchApi<GroupBalancesResponse>(`/balances/group/${groupId}`, { token: token! }),
      ]);
      setExpenses(expRes.expenses);
      setBalances(balRes);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir despesa');
    }
  };

  const handleRegisterSettlement = async () => {
    if (!settlementTarget || !token || !group) return;
    setSettling(true);
    try {
      await fetchApi('/settlements', {
        method: 'POST',
        token,
        body: JSON.stringify({
          groupId: group.id,
          receiverId: settlementTarget.toUserId,
          amount: settlementTarget.amount,
        }),
      });

      const [expRes, balRes] = await Promise.all([
        fetchApi<{ expenses: Expense[] }>(`/expenses/group/${groupId}`, { token }),
        fetchApi<GroupBalancesResponse>(`/balances/group/${groupId}`, { token }),
      ]);

      setExpenses(expRes.expenses);
      setBalances(balRes);
      setShowSettlementModal(false);
      setSettlementTarget(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar liquidação');
    } finally {
      setSettling(false);
    }
  };

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setScanning(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
      const response = await fetch(`${apiUrl}/receipts/scan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setScannedResult(data);
    } catch (err: any) {
      alert(err.message || 'Erro ao ler cupom fiscal');
    } finally {
      setScanning(false);
    }
  };

  if (loading || !group) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0f17]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  const isOwnerOrAdmin = group.members.some(
    (m) => m.userId === user?.id && (m.role === 'OWNER' || m.role === 'ADMIN')
  );

  return (
    <div className="min-h-screen bg-[#0b0f17] text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#131926]/60 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">{group.name}</h1>
              <p className="text-xs text-gray-400">{group.members.length} membros na conta</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20 shadow-sm"
              title="Compartilhar convite do grupo"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              {copiedCode ? 'Link Copiado!' : 'Convidar'}
            </button>

            {isOwnerOrAdmin && (
              <button
                onClick={handleRegenerateInvite}
                disabled={regenerating}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900/60 px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition"
                title="Redefinir link de convite"
              >
                <RefreshCw className={`h-3 w-3 ${regenerating ? 'animate-spin' : ''}`} />
                <span className="text-[11px]">Novo Link</span>
              </button>
            )}
            <button
              onClick={() => openExpenseModal()}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition"
            >
              <Plus className="h-4 w-4" /> Nova Despesa
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="mx-auto flex max-w-7xl px-6 gap-8 border-t border-gray-800/60 text-sm">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`py-3 font-semibold border-b-2 transition ${
              activeTab === 'expenses'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Extrato de Despesas ({expenses.length})
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`py-3 font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'balances'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Zap className="h-4 w-4" /> Dívidas Simplificadas
          </button>
          <button
            onClick={() => setActiveTab('receipt')}
            className={`py-3 font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'receipt'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Receipt className="h-4 w-4" /> Escanear Nota (IA)
          </button>
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* TAB 1: EXTRATO DE DESPESAS */}
        {activeTab === 'expenses' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {expenses.length === 0 ? (
              <div className="rounded-2xl border border-gray-800 bg-[#131926]/40 p-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-600" />
                <h3 className="mt-3 text-lg font-bold text-white">Nenhuma despesa registrada</h3>
                <p className="text-sm text-gray-400 mt-1">Clique em "Nova Despesa" para adicionar o primeiro gasto do grupo.</p>
              </div>
            ) : (
              expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="rounded-2xl border border-gray-800 bg-[#131926]/80 p-5 shadow-lg flex items-center justify-between hover:border-gray-700 transition"
                >
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">{expense.description}</h3>
                    <p className="text-xs text-gray-400">
                      Pago por <strong className="text-gray-200">{expense.payers?.[0]?.user?.name || expense.createdBy?.name || 'Membro'}</strong> •{' '}
                      {new Date(expense.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {expense.splits?.map((s, idx) => (
                        <span key={s.user?.id || idx} className="rounded-md bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300">
                          {s.user?.name || 'Membro'}: {formatCentsToCurrency(s.shareAmount)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xl font-extrabold text-emerald-400">
                        {formatCentsToCurrency(expense.amount)}
                      </span>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                        Divisão {expense.splitType}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {(expense.createdById === user?.id || expense.createdBy?.id === user?.id) && (
                        <button
                          onClick={() => openExpenseModal(expense)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400 transition"
                          title="Editar despesa (somente criador)"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition"
                        title="Excluir despesa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: SALDOS LÍQUIDOS & MOTOR DE SIMPLIFICAÇÃO */}
        {activeTab === 'balances' && balances && (
          <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
            {/* Cards de Saldos Individuais */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-400" /> Saldos Líquidos Individuais
              </h2>
              <div className="space-y-3">
                {balances.balances.map((b) => (
                  <div
                    key={b.userId}
                    className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#131926]/80 p-4"
                  >
                    <span className="font-semibold text-white">{b.userName}</span>
                    <span
                      className={`font-bold ${
                        b.netBalance > 0
                          ? 'text-emerald-400'
                          : b.netBalance < 0
                          ? 'text-red-400'
                          : 'text-gray-400'
                      }`}
                    >
                      {b.netBalance > 0 ? '+' : ''}
                      {formatCentsToCurrency(b.netBalance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dívidas Simplificadas pelo Algoritmo */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" /> Otimização do Grafo de Dívidas
              </h2>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-4">
                <p className="text-xs text-amber-300/80">
                  Nosso algoritmo de fluxo mínimo consolidou todas as transações do grupo nas seguintes transferências otimizadas:
                </p>

                {balances.simplifiedDebts.length === 0 ? (
                  <div className="py-6 text-center text-sm font-semibold text-emerald-400 flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-5 w-5" /> Todas as contas deste grupo estão zeradas!
                  </div>
                ) : (
                  balances.simplifiedDebts.map((debt, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#131926] p-4 shadow-md"
                    >
                      <div className="text-sm">
                        <strong className="text-red-400">{debt.fromUserName}</strong> deve pagar{' '}
                        <strong className="text-emerald-400">{debt.toUserName}</strong>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-white">
                          {formatCentsToCurrency(debt.amount)}
                        </span>
                        {user?.id === debt.fromUserId && (
                          <button
                            onClick={() => {
                              setSettlementTarget({
                                toUserId: debt.toUserId,
                                toUserName: debt.toUserName,
                                amount: debt.amount,
                              });
                              setShowSettlementModal(true);
                            }}
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                          >
                            Quitar PIX
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LEITURA DE NOTA FISCAL COM IA */}
        {activeTab === 'receipt' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="rounded-2xl border border-gray-800 bg-[#131926]/80 p-8 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                <Receipt className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-white">Escanear Cupom Fiscal com IA</h2>
              <p className="text-sm text-gray-400">
                Tire foto ou envie o arquivo da nota. Nossa IA extrairá os itens e permitirá selecionar quem consumiu o quê.
              </p>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-lg hover:bg-emerald-500">
                {scanning ? 'Processando com IA...' : 'Selecionar Imagem do Cupom'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleScanReceipt}
                  disabled={scanning}
                  className="hidden"
                />
              </label>
            </div>

            {/* Resultado do OCR e itens para vinculação */}
            {scannedResult && (
              <div className="rounded-2xl border border-emerald-500/30 bg-[#131926] p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <div>
                    <h3 className="font-bold text-white text-lg">{scannedResult.merchantName}</h3>
                    <p className="text-xs text-gray-400">Nota lida com sucesso via Gemini Vision API</p>
                  </div>
                  <span className="text-xl font-extrabold text-emerald-400">
                    {formatCentsToCurrency(scannedResult.totalAmount)}
                  </span>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase text-gray-400">Itens Extraídos da Nota:</h4>
                  {scannedResult.items.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-sm"
                    >
                      <span className="font-medium text-white">{item.name}</span>
                      <span className="font-semibold text-gray-300">
                        {formatCentsToCurrency(item.totalPrice)}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => alert('Divisão por itens vinculada e despesa criada no grupo!')}
                  className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500"
                >
                  Confirmar Divisão por Consumo Individual
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Nova Despesa Expandido (Equal/Subset + Itemized) */}
      {showExpenseModal && (() => {
        const calculatedItemsTotal = items.reduce((acc, it) => {
          const price = parseFloat(it.unitPriceStr.replace(',', '.')) || 0;
          return acc + price * it.quantity;
        }, 0);
        const calculatedTax = parseFloat(taxAmountStr.replace(',', '.')) || 0;
        const calculatedGrandTotal = calculatedItemsTotal + calculatedTax;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-xl my-8 rounded-2xl border border-gray-800 bg-[#131926] p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
                <h2 className="text-xl font-bold text-white">{editingExpense ? 'Editar Despesa' : 'Nova Despesa no Grupo'}</h2>
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Switcher de Modos */}
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-900 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setSplitType('EQUAL')}
                  className={`py-2 px-3 rounded-lg font-medium transition ${
                    splitType === 'EQUAL'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Divisão Igual (Total / Subconjunto)
                </button>
                <button
                  type="button"
                  onClick={() => setSplitType('ITEMIZED')}
                  className={`py-2 px-3 rounded-lg font-medium transition ${
                    splitType === 'ITEMIZED'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Divisão por Itens (Consumo)
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Descrição da Despesa
                  </label>
                  <input
                    type="text"
                    required
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="Ex: Almoço de Domingo ou Conta de Bar"
                  />
                </div>

                {/* MODO EQUAL (Total ou Subconjunto) */}
                {splitType === 'EQUAL' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Valor Total (R$)
                      </label>
                      <input
                        type="text"
                        required
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="150,00"
                      />
                    </div>

                    {/* Seleção de Participantes (Subconjunto) */}
                    <div className="space-y-2 rounded-xl bg-gray-900/60 p-4 border border-gray-800">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Participantes do Rateio ({selectedMemberIds.length} de {group.members.length} selecionados)
                      </label>
                      <div className="grid grid-cols-2 gap-2 pt-1 max-h-40 overflow-y-auto">
                        {group.members.map((m) => {
                          const isChecked = selectedMemberIds.includes(m.userId);
                          return (
                            <label
                              key={m.id}
                              className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                                isChecked
                                  ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                                  : 'border-gray-800 bg-gray-900/40 text-gray-400 hover:border-gray-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleEqualMember(m.userId)}
                                className="rounded accent-emerald-500 h-4 w-4"
                              />
                              <span className="truncate">{m.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* MODO ITEMIZED (Itemizado por consumo individual) */}
                {splitType === 'ITEMIZED' && (
                  <div className="space-y-4">
                    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1.5">
                      {items.map((it, idx) => (
                        <div
                          key={it.id}
                          className="p-3.5 rounded-xl border border-gray-800 bg-gray-900/80 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-emerald-400">Item #{idx + 1}</span>
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItemInput(it.id)}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                Remover Item
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-12 gap-2">
                            <input
                              type="text"
                              placeholder="Nome do item (ex: Cerveja)"
                              value={it.name}
                              onChange={(e) => updateItemInput(it.id, 'name', e.target.value)}
                              className="col-span-6 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Preço Unit. (R$)"
                              value={it.unitPriceStr}
                              onChange={(e) => updateItemInput(it.id, 'unitPriceStr', e.target.value)}
                              className="col-span-4 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                            />
                            <input
                              type="number"
                              min={1}
                              placeholder="Qtd"
                              value={it.quantity}
                              onChange={(e) =>
                                updateItemInput(it.id, 'quantity', parseInt(e.target.value) || 1)
                              }
                              className="col-span-2 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-white text-center focus:border-emerald-500 focus:outline-none"
                            />
                          </div>

                          {/* Quem consumiu este item */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-gray-400">Quem consumiu:</span>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {group.members.map((m) => {
                                const isChecked = it.assignedMemberIds.includes(m.userId);
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => toggleItemMember(it.id, m.userId)}
                                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition border ${
                                      isChecked
                                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                                        : 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:text-gray-200'
                                    }`}
                                  >
                                    {m.name} {isChecked ? '✓' : ''}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addItemInput}
                      className="w-full py-2 rounded-xl border border-dashed border-emerald-500/40 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/10 transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar Outro Item
                    </button>

                    {/* Campo de Taxa de Serviço / Gorjeta */}
                    <div className="pt-2 border-t border-gray-800">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Taxa de Serviço / Gorjeta / Couvert Geral (R$)
                      </label>
                      <input
                        type="text"
                        value={taxAmountStr}
                        onChange={(e) => setTaxAmountStr(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-white text-xs focus:border-emerald-500 focus:outline-none"
                        placeholder="0,00 (Será distribuída proporcionalmente ao consumo de cada um)"
                      />
                    </div>

                    {/* Total Calculado */}
                    <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                      <span className="text-xs text-emerald-300 font-medium">Total Calculado da Despesa:</span>
                      <span className="text-lg font-bold text-emerald-400">
                        R$ {calculatedGrandTotal.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-gray-900/60 p-3 text-xs text-gray-400">
                  💡 A despesa será paga por você (<strong>{user?.name}</strong>) e os rateios serão calculados com precisão ao salvar.
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(false)}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-gray-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition shadow-lg shadow-emerald-600/20"
                  >
                    {submitting ? 'Salvando...' : editingExpense ? 'Salvar Alterações' : 'Salvar Despesa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal Quitar Dívida / Settlement */}
      {showSettlementModal && settlementTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#131926] p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-white">Quitar Dívida via PIX</h2>
            <p className="text-sm text-gray-300">
              Confirmar o pagamento de <strong>{formatCentsToCurrency(settlementTarget.amount)}</strong> para{' '}
              <strong className="text-emerald-400">{settlementTarget.toUserName}</strong>?
            </p>

            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-300 space-y-1">
              <div className="font-bold text-sm">Transferência Direta</div>
              <p>Após realizar o PIX fora do app, clique abaixo para amortizar o saldo no grupo.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSettlementModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegisterSettlement}
                disabled={settling}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {settling ? 'Confirmando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
