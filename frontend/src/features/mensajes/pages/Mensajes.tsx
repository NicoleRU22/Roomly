import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { useConversaciones, useConversacion } from '../useMensajes';
import { Send, MessageCircle, Search, Check, CheckCheck } from 'lucide-react';

const MAX_MESSAGE_LENGTH = 2000;

const formatTime = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

export const Mensajes: React.FC = () => {
  const { user } = useAuthStore();
  const { conversaciones, fetchConversaciones } = useConversaciones();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const { mensajes, sending, sendMensaje } = useConversacion(selectedUserId);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedUserId && conversaciones.length > 0) {
      setSelectedUserId(conversaciones[0].userId);
    }
  }, [conversaciones, selectedUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes]);

  const selectedConversacion = conversaciones.find(c => c.userId === selectedUserId);

  const filteredConversaciones = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversaciones;
    return conversaciones.filter(c => c.name.toLowerCase().includes(query));
  }, [conversaciones, search]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const content = draft;
    setDraft('');
    setSendError(null);
    try {
      await sendMensaje(content);
      fetchConversaciones();
    } catch (err: any) {
      setDraft(content);
      setSendError(err?.response?.data?.error || 'No se pudo enviar el mensaje.');
    }
  };

  return (
    <div className="flex h-[calc(100dvh-160px)] bg-card border border-border rounded-2xl overflow-hidden">
      {/* Lista de conversaciones */}
      <aside className="w-full max-w-[280px] border-r border-border flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-border space-y-3">
          <h2 className="text-sm font-black text-foreground uppercase tracking-wider">Mensajes</h2>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversación..."
              className="w-full pl-8 pr-3 py-2 bg-muted rounded-lg text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-purple-650/40"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversaciones.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10 px-4">No tienes conversaciones disponibles.</p>
          ) : filteredConversaciones.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10 px-4">Ninguna conversación coincide con "{search}".</p>
          ) : (
            filteredConversaciones.map(conv => (
              <button
                key={conv.userId}
                onClick={() => {
                  setSelectedUserId(conv.userId);
                  setSendError(null);
                  fetchConversaciones();
                }}
                className={`w-full text-left px-5 py-3.5 border-b border-border/60 hover:bg-muted/50 transition-colors ${
                  selectedUserId === conv.userId ? 'bg-muted' : ''
                }`}
              >
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-sm font-bold text-foreground truncate">{conv.name}</span>
                  <span className="text-[9px] text-muted-foreground shrink-0 ml-2">{formatTime(conv.lastMessageAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[11px] text-muted-foreground truncate">{conv.lastMessage || 'Sin mensajes aún'}</p>
                  {conv.unreadCount > 0 && (
                    <span className="ml-2 min-w-[16px] h-[16px] px-1 flex items-center justify-center bg-purple-650 rounded-full text-[9px] font-black text-white shrink-0">
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Panel de chat */}
      <div className="flex-1 flex flex-col">
        {selectedConversacion ? (
          <>
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-sm font-black text-foreground">{selectedConversacion.name}</h3>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {mensajes.map(m => {
                const mine = m.senderId === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                      mine ? 'bg-purple-650 text-white rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p className={`text-[9px] mt-1 flex items-center gap-1 justify-end ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>
                        {formatTime(m.createdAt)}
                        {mine && (m.isRead ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {mensajes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-10">Aún no hay mensajes. Escribe el primero.</p>
              )}
            </div>

            <div className="px-6 pt-2 border-t border-border">
              {sendError && <p className="text-[11px] text-red-500 mb-2">{sendError}</p>}
            </div>
            <form onSubmit={handleSend} className="px-6 pb-4 flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                  maxLength={MAX_MESSAGE_LENGTH}
                  placeholder="Escribe un mensaje..."
                  className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-purple-650/40"
                />
                {draft.length > MAX_MESSAGE_LENGTH * 0.9 && (
                  <span className="absolute -top-4 right-1 text-[9px] text-muted-foreground">
                    {draft.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="p-2.5 bg-purple-650 text-white rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <MessageCircle className="w-8 h-8" />
            <p className="text-sm">Selecciona una conversación para empezar a chatear.</p>
          </div>
        )}
      </div>
    </div>
  );
};
