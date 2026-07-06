import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { useConversaciones, useConversacion } from '../useMensajes';
import { Send, MessageCircle } from 'lucide-react';

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const content = draft;
    setDraft('');
    try {
      await sendMensaje(content);
      fetchConversaciones();
    } catch {
      setDraft(content);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-160px)] bg-card border border-border rounded-2xl overflow-hidden">
      {/* Lista de conversaciones */}
      <aside className="w-full max-w-[280px] border-r border-border flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-black text-foreground uppercase tracking-wider">Mensajes</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversaciones.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10 px-4">No tienes conversaciones disponibles.</p>
          ) : (
            conversaciones.map(conv => (
              <button
                key={conv.userId}
                onClick={() => {
                  setSelectedUserId(conv.userId);
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
                      <p className={`text-[9px] mt-1 ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>{formatTime(m.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
              {mensajes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-10">Aún no hay mensajes. Escribe el primero.</p>
              )}
            </div>

            <form onSubmit={handleSend} className="px-6 py-4 border-t border-border flex items-center gap-3">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="flex-1 px-4 py-2.5 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-purple-650/40"
              />
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
