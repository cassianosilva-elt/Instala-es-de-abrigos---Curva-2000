
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, User as UserIcon, ChevronLeft, ChevronDown, Minimize2, Loader2 } from 'lucide-react';
import { User, ChatMessage, UserRole } from '../types';
import { getAllUsers, getMessagesByConversation, sendMessage, getOrCreateConversation } from '../api/fieldManagerApi';
import { supabase } from '../api/supabaseClient';

interface ChatWidgetProps {
    currentUser: User;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ currentUser }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [contacts, setContacts] = useState<User[]>([]);
    const [selectedContact, setSelectedContact] = useState<User | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            loadContacts();
        }
    }, [isOpen, currentUser]);

    useEffect(() => {
        if (selectedContact) {
            setupConversation(selectedContact.id);
        } else {
            setConversationId(null);
            setMessages([]);
        }
    }, [selectedContact]);

    useEffect(() => {
        if (conversationId) {
            loadMessages(conversationId);

            // Real-time listener for new messages in this conversation
            const channel = supabase
                .channel(`chat_${conversationId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `conversation_id=eq.${conversationId}`
                }, (payload) => {
                    const msg = payload.new as any;
                    const formattedMsg: ChatMessage = {
                        id: msg.id,
                        senderId: msg.sender_id,
                        receiverId: '',
                        content: msg.content,
                        timestamp: new Date(msg.created_at),
                        read: msg.is_read
                    };
                    setMessages(prev => [...prev, formattedMsg]);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [conversationId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadContacts = async () => {
        setLoadingContacts(true);
        try {
            const users = await getAllUsers(currentUser.companyId);
            setContacts(users.filter(u => u.id !== currentUser.id));
        } catch (error) {
            console.error("Erro ao carregar contatos", error);
        } finally {
            setLoadingContacts(false);
        }
    };

    const setupConversation = async (contactId: string) => {
        setLoadingMessages(true);
        try {
            const id = await getOrCreateConversation(currentUser.id, contactId);
            setConversationId(id);
        } catch (error) {
            console.error("Erro ao configurar conversa", error);
        } finally {
            setLoadingMessages(false);
        }
    };

    const loadMessages = async (id: string) => {
        try {
            const msgs = await getMessagesByConversation(id);
            setMessages(msgs);
        } catch (error) {
            console.error("Erro ao carregar mensagens", error);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !conversationId) return;

        const content = newMessage.trim();
        setNewMessage(''); // Clear early for better UX

        try {
            await sendMessage(conversationId, currentUser.id, content);
        } catch (error) {
            console.error("Erro ao enviar mensagem", error);
            // Re-set if failed? Or show error
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-primary text-white p-4 rounded-full shadow-lg hover:shadow-primary/40 transition-all z-50 flex items-center justify-center scale-100 hover:scale-110 active:scale-95"
            >
                <MessageSquare size={24} />
            </button>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 bg-white rounded-[28px] shadow-2xl z-50 overflow-hidden flex flex-col transition-all duration-300 border border-slate-100 ${isMinimized ? 'w-72 h-16' : 'w-80 sm:w-96 h-[550px]'}`}>
            {/* Header */}
            <div className="bg-primary p-4 flex items-center justify-between text-white shrink-0">
                <div className="flex items-center space-x-3">
                    {selectedContact ? (
                        <button onClick={() => setSelectedContact(null)} className="hover:bg-white/10 p-2 rounded-xl transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                    ) : (
                        <div className="bg-white/20 p-2 rounded-xl">
                            <MessageSquare size={18} />
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="font-black text-sm uppercase tracking-wider truncate">
                            {selectedContact ? selectedContact.name : 'Mensagens'}
                        </span>
                        {selectedContact && (
                            <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest leading-none">
                                {selectedContact.role.replace('PARCEIRO_', '')}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center space-x-1">
                    <button onClick={() => setIsMinimized(!isMinimized)} className="hover:bg-white/10 p-2 rounded-xl transition-colors">
                        {isMinimized ? <ChevronDown size={18} /> : <Minimize2 size={16} />}
                    </button>
                    <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-2 rounded-xl transition-colors">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {!isMinimized && (
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
                    {!selectedContact ? (
                        // Contact List
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {loadingContacts ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                                    <Loader2 className="animate-spin" size={24} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Buscando Contatos</span>
                                </div>
                            ) : contacts.length > 0 ? (
                                contacts.map(contact => (
                                    <button
                                        key={contact.id}
                                        onClick={() => setSelectedContact(contact)}
                                        className="w-full flex items-center gap-4 p-4 bg-white hover:bg-white hover:shadow-md rounded-2xl transition-all text-left border border-transparent hover:border-slate-100 group"
                                    >
                                        <div className="relative">
                                            <img
                                                src={contact.avatar}
                                                alt={contact.name}
                                                className="w-12 h-12 rounded-2xl object-cover bg-slate-100 border-2 border-transparent group-hover:border-primary/20 transition-all"
                                            />
                                            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm"></span>
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-black text-slate-800 text-sm truncate">{contact.name}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{contact.companyName}</p>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="text-center p-8 text-slate-400">
                                    <p className="text-xs font-bold italic">Nenhum contato disponível.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Chat Conversation
                        <>
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {loadingMessages ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                                        <Loader2 className="animate-spin" size={24} />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center py-10">
                                        <div className="bg-slate-100 inline-block p-4 rounded-3xl mb-4">
                                            <MessageSquare className="text-slate-300" size={32} />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inicie a conversa!</p>
                                    </div>
                                ) : (
                                    messages.map(msg => {
                                        const isMe = msg.senderId === currentUser.id;
                                        return (
                                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                                                <div className={`max-w-[85%] rounded-[24px] p-4 text-sm font-bold leading-relaxed shadow-sm ${isMe
                                                    ? 'bg-primary text-white rounded-br-none shadow-primary/20'
                                                    : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none shadow-slate-200/50'
                                                    }`}>
                                                    <p>{msg.content}</p>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest block mt-2 ${isMe ? 'text-white/60' : 'text-slate-300'}`}>
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex items-center gap-3">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Digite sua mensagem..."
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-[20px] px-5 py-3.5 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    className="bg-primary text-white p-3.5 rounded-2xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 disabled:opacity-20 disabled:grayscale transition-all"
                                >
                                    <Send size={18} />
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
