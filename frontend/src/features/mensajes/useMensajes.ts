import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../core/services/api';

export interface Conversacion {
  userId: number;
  name: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface Mensaje {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
}

const POLL_INTERVAL_MS = 30000;

export const useUnreadMensajesCount = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/mensajes/unread-count');
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error('Error al obtener el conteo de mensajes:', err);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchUnreadCount]);

  return { unreadCount, fetchUnreadCount };
};

export const useConversaciones = () => {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConversaciones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/mensajes/conversaciones');
      setConversaciones(res.data);
    } catch (err) {
      console.error('Error al obtener conversaciones:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversaciones();
    const interval = setInterval(fetchConversaciones, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchConversaciones]);

  return { conversaciones, loading, fetchConversaciones };
};

export const useConversacion = (otherUserId: number | null) => {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchMensajes = useCallback(async () => {
    if (!otherUserId) return;
    try {
      const res = await api.get(`/mensajes/${otherUserId}`);
      setMensajes(res.data);
    } catch (err) {
      console.error('Error al obtener la conversación:', err);
    }
  }, [otherUserId]);

  const markAsRead = useCallback(async () => {
    if (!otherUserId) return;
    try {
      await api.put(`/mensajes/${otherUserId}/read`);
    } catch (err) {
      console.error('Error al marcar la conversación como leída:', err);
    }
  }, [otherUserId]);

  const sendMensaje = useCallback(async (content: string) => {
    if (!otherUserId || !content.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/mensajes/${otherUserId}`, { content });
      setMensajes(prev => [...prev, res.data]);
    } catch (err) {
      console.error('Error al enviar el mensaje:', err);
      throw err;
    } finally {
      setSending(false);
    }
  }, [otherUserId]);

  useEffect(() => {
    if (!otherUserId) {
      setMensajes([]);
      return;
    }
    setLoading(true);
    fetchMensajes().finally(() => setLoading(false));
    markAsRead();
    const interval = setInterval(fetchMensajes, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [otherUserId, fetchMensajes, markAsRead]);

  return { mensajes, loading, sending, sendMensaje };
};
