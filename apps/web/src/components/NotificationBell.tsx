'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { fetchApi } from '@/lib/api';
import { NotificationResponse, formatCentsToCurrency } from '@racho/shared';
import { Bell, Check, X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface NotificationBellProps {
  onActionComplete?: () => void;
}

export function NotificationBell({ onActionComplete }: NotificationBellProps) {
  const { token } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchApi<{ unreadCount: number }>('/notifications/unread-count', { token });
      setUnreadCount(res.unreadCount);
    } catch {
      // Ignorar erros de polling silencioso
    }
  }, [token]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchApi<{ notifications: NotificationResponse[] }>('/notifications', { token });
      setNotifications(res.notifications);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Polling leve a cada 15 segundos para atualizar o badge (+1)
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const handleConfirmSettlement = async (settlementId: string, notifId: string) => {
    if (!token) return;
    setProcessingId(notifId);
    try {
      await fetchApi(`/settlements/${settlementId}/confirm`, {
        method: 'POST',
        token,
      });

      // Atualizar lista local de notificações
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      if (onActionComplete) {
        onActionComplete();
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao confirmar recebimento');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSettlement = async (settlementId: string, notifId: string) => {
    if (!token) return;
    setProcessingId(notifId);
    try {
      await fetchApi(`/settlements/${settlementId}/reject`, {
        method: 'POST',
        token,
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      if (onActionComplete) {
        onActionComplete();
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao contestar pagamento');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAsRead = async (notifId: string) => {
    if (!token) return;
    try {
      await fetchApi(`/notifications/${notifId}/read`, {
        method: 'PATCH',
        token,
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Ignorar erro
    }
  };

  return (
    <div className="relative">
      {/* Botão Bell na Navbar */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex items-center justify-center rounded-xl border border-gray-800 bg-gray-900/80 p-2.5 text-gray-300 hover:bg-gray-800 hover:text-white transition"
        title="Notificações"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-extrabold text-black shadow-lg shadow-emerald-500/30 animate-pulse">
            +{unreadCount}
          </span>
        )}
      </button>

      {/* Drawer / Popup de Notificações */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-gray-800 bg-[#131926] p-4 shadow-2xl z-50 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Notificações</h3>
              {unreadCount > 0 && (
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                  {unreadCount} pendente{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white text-xs p-1"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-gray-400 space-y-2">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto text-emerald-400" />
              <p>Carregando notificações...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400 space-y-1">
              <p className="font-semibold text-gray-300">Nenhuma notificação</p>
              <p>Você está em dia com todas as atividades dos seus grupos!</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
              {notifications.map((notif) => {
                const isAwaiting = notif.type === 'SETTLEMENT_AWAITING_APPROVAL';
                const isProcessing = processingId === notif.id;

                return (
                  <div
                    key={notif.id}
                    className={`rounded-xl border p-3 text-xs space-y-2 transition ${
                      notif.read
                        ? 'border-gray-800/60 bg-gray-900/40 text-gray-400'
                        : 'border-emerald-500/30 bg-emerald-500/5 text-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        {isAwaiting ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        ) : notif.type === 'SETTLEMENT_CONFIRMED' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        )}
                        <span>{notif.title}</span>
                      </div>
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 mt-1"></span>
                      )}
                    </div>

                    <p className="leading-relaxed text-gray-300">{notif.message}</p>

                    {/* Ações diretas no card para o Cobrador (Confirmar / Contestar) */}
                    {isAwaiting && notif.settlementId && !notif.read && (
                      <div className="pt-2 border-t border-gray-800/80 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleConfirmSettlement(notif.settlementId!, notif.id)}
                          className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 px-2 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition shadow-sm"
                        >
                          <Check className="h-3 w-3" />
                          {isProcessing ? 'Confirmando...' : 'Confirmar Recebimento'}
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleRejectSettlement(notif.settlementId!, notif.id)}
                          className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 py-1.5 px-2 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition"
                        >
                          <X className="h-3 w-3" />
                          Não Recebi
                        </button>
                      </div>
                    )}

                    {!isAwaiting && !notif.read && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-[10px] text-gray-400 hover:text-white underline pt-1"
                      >
                        Marcar como lida
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
