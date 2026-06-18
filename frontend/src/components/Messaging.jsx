// Messaging.js
import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../socket';

export default function Messaging({
  token,
  currentUser,
  onRefreshHistory,
  initialMechanicId = null,
  onClearInitialMechanic
}) {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');

  // Sockets based states
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});

  // Floating notifications/toasts alerts state
  const [alerts, setAlerts] = useState([]);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Initial downloads
  const fetchChats = async (silent = false) => {
    if (!silent) setLoadingChats(true);
    try {
      const res = await fetch('/api/chats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Could not download conversations.');
      const data = await res.json();
      setChats(data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoadingChats(false);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const res = await fetch('/api/chats/online', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOnlineUsers(new Set(data));
      }
    } catch (err) {
      console.error('[Contacts] Error fetching online users:', err);
    }
  };

  const fetchMessages = async (chatId, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Could not pull messages.');
      const data = await res.json();
      setMessages(data);
      scrollToBottom();
    } catch (err) {
      setError(err.message || 'Error downloading messages.');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  const triggerToast = (text) => {
    const freshId = Math.random().toString(36).substring(2, 9);
    setAlerts(prev => [...prev, { id: freshId, text }]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== freshId));
    }, 4500);
  };

  // Scroll current chat to tail end
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  // Typing event emissions
  const handleInputChange = (text) => {
    setNewMessageText(text);

    const socket = getSocket();
    const activeChat = chats.find(c => c.id === activeChatId);
    if (!socket || !activeChat || !currentUser) return;

    const receiverId = activeChat.otherParticipant.id;

    // Emit typing status
    socket.emit('typing', {
      chatId: activeChatId,
      senderId: currentUser.id,
      receiverId
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', {
        chatId: activeChatId,
        senderId: currentUser.id,
        receiverId
      });
    }, 1500);
  };

  // Immediate send message using Socket.io
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessageText.trim() || !activeChatId) return;

    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat) return;

    const textToSend = newMessageText.trim();
    setNewMessageText('');

    const socket = getSocket();
    const receiverId = activeChat.otherParticipant.id;

    // Clear local typing timeout and let receiver know we stopped
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (socket) {
      socket.emit('stop_typing', {
        chatId: activeChatId,
        senderId: currentUser.id,
        receiverId
      });

      // Send cleanly over WebSocket according to architectural specification
      socket.emit('send_message', {
        chatId: activeChatId,
        senderId: currentUser.id,
        senderRole: currentUser.role === 'mechanic' ? 'mechanic' : 'user',
        receiverId,
        message: textToSend
      });
    } else {
      // Fallback REST endpoint if socket is not ready yet
      fetch(`/api/chats/${activeChatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: textToSend })
      }).then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      }).then(msg => {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        scrollToBottom();
        fetchChats(true);
      }).catch(err => {
        alert('Failed backup REST message transmission.');
      });
    }
  };

  // First communication contact initiation
  const handleInitialContactMsg = async (text) => {
    if (!initialMechanicId) return;
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mechanicId: initialMechanicId,
          message: text
        })
      });
      if (!res.ok) throw new Error('Could not initiate conversation with shop.');
      const data = await res.json();
      
      triggerToast('Conversation successfully created!');
      if (onClearInitialMechanic) onClearInitialMechanic();
      
      // Reload chats list and open active conversation
      await fetchChats();
      setActiveChatId(data.chat.id);
      fetchMessages(data.chat.id);
    } catch (err) {
      alert(err.message || 'Could not start chat.');
    }
  };

  // Setup initial components
  useEffect(() => {
    fetchChats();
    fetchOnlineUsers();
  }, [token]);

  // Hook WebSocket event handlers
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Listen to real-time inbound chat messages
    const handleReceiveMessage = (msg) => {
      // Check if message is for the currently open chat
      if (activeChatId && msg.chatId === activeChatId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();

        // Mark message as read instantly
        socket.emit('message_read', {
          chatId: activeChatId,
          messageId: msg.id,
          readerId: currentUser.id
        });
      } else {
        // Trigger alert toast for background chat
        const senderChat = chats.find(c => c.id === msg.chatId);
        if (msg.senderId !== currentUser.id) {
          triggerToast(`New message from ${senderChat?.otherParticipant?.name || 'Customer'}: "${msg.message.substring(0, 30)}..."`);
        }
      }

      // Update parent list message status & increment unread counts
      setChats(prev => {
        return prev.map(c => {
          if (c.id === msg.chatId) {
            const isUnread = msg.senderId !== currentUser.id && c.id !== activeChatId;
            return {
              ...c,
              lastMessage: msg,
              unreadCount: isUnread ? (c.unreadCount || 0) + 1 : c.unreadCount,
              updatedAt: msg.timestamp
            };
          }
          return c;
        }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
    };

    // Listen to our confirmation back from server so there's zero sync latency
    const handleMessageConfirm = (msg) => {
      if (activeChatId && msg.chatId === activeChatId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }

      setChats(prev => {
        return prev.map(c => {
          if (c.id === msg.chatId) {
            return {
              ...c,
              lastMessage: msg,
              updatedAt: msg.timestamp
            };
          }
          return c;
        }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
    };

    // Typing Indicators handling
    const handleTyping = (data) => {
      if (activeChatId && data.chatId === activeChatId && data.senderId !== currentUser.id) {
        setTypingUsers(prev => ({ ...prev, [data.chatId]: true }));
      }
    };

    const handleStopTyping = (data) => {
      if (data.chatId) {
        setTypingUsers(prev => ({ ...prev, [data.chatId]: false }));
      }
    };

    // Live Read indicator sync
    const handleMarkedRead = (data) => {
      if (activeChatId && data.chatId === activeChatId) {
        setMessages(prev => prev.map(m => m.chatId === data.chatId ? { ...m, isRead: true } : m));
      }

      setChats(prev => prev.map(c => {
        if (c.id === data.chatId && data.readerId !== currentUser.id) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      }));
    };

    // Presence Awareness listening
    const handleStatusChange = (data) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (data.status === 'online') {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });

      if (data.onlineUsers) {
        setOnlineUsers(new Set(data.onlineUsers));
      }
    };

    const handleJoinedResponse = (data) => {
      if (data.onlineUsers) {
        setOnlineUsers(new Set(data.onlineUsers));
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_sent_confirm', handleMessageConfirm);
    socket.on('typing', handleTyping);
    socket.on('stop_typing', handleStopTyping);
    socket.on('messages_marked_read', handleMarkedRead);
    socket.on('user_status_change', handleStatusChange);
    socket.on('room_joined', handleJoinedResponse);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_sent_confirm', handleMessageConfirm);
      socket.off('typing', handleTyping);
      socket.off('stop_typing', handleStopTyping);
      socket.off('messages_marked_read', handleMarkedRead);
      socket.off('user_status_change', handleStatusChange);
      socket.off('room_joined', handleJoinedResponse);
    };
  }, [activeChatId, chats, currentUser]);

  // When clicking onto a new chat dialog box
  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId);
    
    // Clear typing markers for safety
    setTypingUsers(prev => ({ ...prev, [chatId]: false }));

    // Send read sync notice over WebSocket immediately
    const socket = getSocket();
    if (socket && currentUser) {
      socket.emit('message_read', { chatId, readerId: currentUser.id });
    }

    fetchMessages(chatId);

    // Reset parent ledger view unread markers
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        return { ...c, unreadCount: 0 };
      }
      return c;
    }));
  };

  // Helpers to render timestamps elegantly
  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div className="relative space-y-6" id="messaging-hub-ui">
      {/* Dynamic Toast System */}
      <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none" id="toasts-portal">
        {alerts.map(a => (
          <div
            key={a.id}
            className="bg-emerald-990 border border-emerald-500/50 shadow-2xl py-3 px-5 text-xs text-white rounded-xl pointer-events-auto flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping"></span>
            <strong>Alert:</strong> {a.text}
          </div>
        ))}
      </div>

      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-white tracking-tight">
          {currentUser.role === 'mechanic' ? 'Mechanic Dispatch Requests' : 'Help Desk & Chat'}
        </h1>
        <p className="text-xs text-slate-400 font-sans">
          {currentUser.role === 'mechanic'
            ? 'Access active customer support tickets, diagnostic sheets, and real-time live dispatch communications.'
            : 'Enquire about diagnostic results, negotiate repair budgets, or check progress real-time.'}
        </p>
      </div>

      {/* Immediate setup for First Inbound Message if user entered direct modal */}
      {initialMechanicId && (
        <div className="bg-slate-900 border border-red-500/20 p-5 rounded-2xl space-y-3" id="initial-contact-banner">
          <div className="flex gap-2 items-center text-xs font-bold text-red-400 font-sans">
            <span className="text-base">💬</span>
            <span>CONTACT MECHANIC INQUIRY</span>
          </div>
          <p className="text-xs text-slate-300 font-sans">
            Submit your initial vehicle problem statement to begin a diagnostic repair communication ticket.
          </p>
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              id="initial-contact-msg-input"
              placeholder="e.g. Hello, I have a dent on my Honda Activa. Can you repair it?"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInitialContactMsg(e.target.value);
                  e.target.value = '';
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-100 py-2 pin-x-3 text-xs rounded-lg outline-none"
            />
            <button
              onClick={() => {
                const el = document.getElementById('initial-contact-msg-input');
                if (el && el.value.trim()) {
                  handleInitialContactMsg(el.value);
                  el.value = '';
                }
              }}
              className="bg-red-650 hover:bg-red-600 text-white font-bold text-xs py-2 px-4 rounded-lg cursor-pointer font-sans"
            >
              Send Inquiry
            </button>
          </div>
        </div>
      )}

      {/* CORE SPLIT SCREEN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden min-h-[550px] shadow-2xl" id="chat-frame-panel">
        
        {/* LEFT COLUMN: CONTACTS LIST / INCOMING REQUESTS */}
        <div className="lg:col-span-4 border-r border-slate-800 flex flex-col w-full h-full">
          <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex justify-between items-center shrink-0">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 font-sans">
              {currentUser.role === 'mechanic' ? 'Customer Requests Ledger' : 'Active Shop Conversations'}
            </span>
            <span className="bg-slate-800 text-[10px] text-slate-300 font-mono py-0.5 px-2 rounded-full font-bold">
              {chats.length} active
            </span>
          </div>

          <div className="overflow-y-auto flex-1 max-h-[500px]" id="contacts-list">
            {loadingChats ? (
              <div className="p-8 text-center" id="chats-loading-spinner">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-red-650 mx-auto"></div>
              </div>
            ) : chats.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-slate-500">
                <p className="text-xs font-sans">No inquiry threads found.</p>
                {currentUser.role === 'user' && (
                  <p className="text-[10px] text-slate-600 leading-normal font-sans">
                    Navigate to the "Mechanics" tab and select a certified specialist to start a conversation!
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-950">
                {chats.map(c => {
                  const isActive = c.id === activeChatId;
                  const isUnread = c.unreadCount > 0;
                  const otherUserOnline = onlineUsers.has(c.otherParticipant.id);
                  
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectChat(c.id)}
                      className={`w-full text-left p-4 transition-all focus:outline-none flex flex-col cursor-pointer ${
                        isActive 
                          ? 'bg-slate-800/80 border-l-4 border-red-500' 
                          : 'hover:bg-slate-850/40'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        {/* Title of Shop or Contact Name */}
                        <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${otherUserOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                          <span className="font-extrabold text-xs text-white truncate">
                            {c.otherParticipant.name}
                          </span>
                        </div>
                        {/* Time of Last Message */}
                        <span className="text-[10px] text-slate-500 font-mono">
                          {c.lastMessage ? formatTime(c.lastMessage.timestamp) : ''}
                        </span>
                      </div>

                      {/* Display active vehicle segment if available */}
                      {c.vehicleDetails && (
                        <div className="mt-1 flex items-center gap-1.5 bg-slate-950/40 text-[9px] font-mono py-0.5 px-2 rounded-md text-emerald-400 w-fit border border-emerald-500/5">
                          <span>🚗</span>
                          <span>{c.vehicleDetails.make} {c.vehicleDetails.model} ({c.vehicleDetails.year})</span>
                        </div>
                      )}

                      {/* Last Message text snippet */}
                      <p className={`text-[11px] mt-2 truncate w-full leading-normal ${
                        isUnread ? 'text-slate-100 font-bold' : 'text-slate-400'
                      }`}>
                        {c.lastMessage ? c.lastMessage.message : 'No messages yet...'}
                      </p>

                      {/* Display outstanding unread mark */}
                      {isUnread && (
                        <span className="bg-red-500 text-white font-extrabold font-mono text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center mt-2.5 self-end shrink-0 scale-90">
                          {c.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CHAT WINDOW */}
        <div className="lg:col-span-8 flex flex-col justify-between w-full h-[550px]" id="chat-content-display">
          
          {activeChat ? (
            <>
              {/* CHAT HUB HEADER */}
              <div className="p-4 border-b border-slate-800 bg-slate-950/10 flex justify-between items-center shrink-0">
                <div className="flex flex-col">
                  {/* Shop Name */}
                  <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${onlineUsers.has(activeChat.otherParticipant.id) ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                    <span>{activeChat.otherParticipant.name}</span>
                    <span className="text-[10px] text-slate-500 font-sans font-normal">
                      ({onlineUsers.has(activeChat.otherParticipant.id) ? '🟢 Online' : '⚪ Offline'})
                    </span>
                  </h3>
                  
                  {activeChat.mechanicDetails && (
                    <span className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      ⭐ {activeChat.mechanicDetails.rating.toFixed(1)} rating • {activeChat.mechanicDetails.phone} • ${activeChat.mechanicDetails.averageHourlyRate}/hr labor fee
                    </span>
                  )}

                  {activeChat.userDetails && (
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Customer Email: <strong className="text-slate-200 select-all font-sans">{activeChat.userDetails.email}</strong>
                    </span>
                  )}
                </div>

                {/* Display vehicle details inside direct header */}
                {activeChat.vehicleDetails && (
                  <div className="text-right">
                    <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider">active vehicle</span>
                    <strong className="text-[10px] font-mono text-emerald-400">
                      {activeChat.vehicleDetails.make} {activeChat.vehicleDetails.model}
                    </strong>
                  </div>
                )}
              </div>

              {/* MESSAGES THREAD PANELS */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[390px] bg-slate-950/10" id="messages-container">
                {loadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-red-650"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-20 text-slate-600 text-xs font-sans">
                    No conversation items recorded. Say hello!
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.senderId === currentUser.id;
                    
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col max-w-[70%] ${
                          isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                        }`}
                      >
                        {/* Bubble */}
                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed ${
                            isMe
                              ? 'bg-red-650 text-white rounded-tr-none'
                              : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-750'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.message}</p>
                          
                          <div className={`text-[9px] mt-1 text-right block font-mono select-none flex items-center justify-end gap-1 ${
                            isMe ? 'text-red-350' : 'text-slate-500'
                          }`}>
                            <span>{formatTime(m.timestamp)}</span>
                            {isMe && (
                              <span className={m.isRead ? 'text-emerald-400' : 'text-slate-400'}>
                                {m.isRead ? '✔✔' : '✔'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* REPLY FORM CONTAINER WITH TYPING INDICATORS */}
              <div className="border-t border-slate-800 bg-slate-950/20 px-4 py-2 shrink-0">
                {/* Typing status notification */}
                {typingUsers[activeChatId] && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping"></span>
                    <span>{activeChat.otherParticipant.name} is typing...</span>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex gap-2 py-1">
                  <input
                    type="text"
                    required
                    placeholder="Type your reply to discuss repair options..."
                    value={newMessageText}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 text-slate-100 py-2.5 px-4 text-xs rounded-xl outline-none"
                  />
                  <button
                    type="submit"
                    className="bg-red-650 hover:bg-red-600 text-white text-xs font-black uppercase tracking-wider py-2.5 px-5 rounded-xl cursor-pointer transition hover:shadow-lg hover:shadow-red-500/10 active:scale-95 shrink-0 font-sans"
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3" id="blank-chat-view">
              <span className="text-3xl select-none">💬</span>
              <h4 className="font-extrabold text-sm text-slate-300 font-sans">No active thread selected</h4>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed font-sans">
                {currentUser.role === 'mechanic'
                  ? 'Select a customer inquiry request from the ledger list on the left to review damage logs, vehicle model details, and reply.'
                  : 'Click a contact shop card on the left list, or visit the Mechanics directory to start communication logs.'}
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}