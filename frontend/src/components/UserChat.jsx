// UserChat.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Car, Wrench, Shield } from 'lucide-react';
import { getSocket } from '../socket';

export default function UserChat({ token, currentUser }) {
  const { requestId } = useParams();
  const navigate = useNavigate();

  // Resolved user backup if prop was lazy loaded
  const resolvedCurrentUser = currentUser || JSON.parse(sessionStorage.getItem('autoaid_user') || '{}');

  const [request, setRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Socket states
  const [isMechanicOnline, setIsMechanicOnline] = useState(false);
  const [isMechanicTyping, setIsMechanicTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const fetchRequestDetails = async (silent = false) => {
    if (!requestId) return;
    try {
      const res = await fetch(`/api/repair-requests/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve repair request details.');
      const data = await res.json();
      setRequest(data);
    } catch (err) {
      if (!silent) setError(err.message || 'Error occurred while loading request details.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchRequestMessages = async (chatId, silent = false) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load chat messages.');
      const data = await res.json();
      setMessages(data);
      if (!silent) scrollToBottom();
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    }
  };

  // Fetch initial online indicators
  const checkInitialMechanicStatus = async (mechanicId) => {
    try {
      const res = await fetch('/api/chats/online', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsMechanicOnline(data.includes(mechanicId));
      }
    } catch (err) {
      console.error('Error checking online status:', err);
    }
  };

  // Typing event indicators
  const handleInputChange = (text) => {
    setNewMessage(text);

    const socket = getSocket();
    if (!socket || !request?.chatId || !request?.mechanicId) return;

    // Dispatch typing state
    socket.emit('typing', {
      chatId: request.chatId,
      senderId: resolvedCurrentUser.id,
      receiverId: request.mechanicId
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', {
        chatId: request.chatId,
        senderId: resolvedCurrentUser.id,
        receiverId: request.mechanicId
      });
    }, 1500);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !request?.chatId || !request?.mechanicId) return;

    const textToSend = newMessage.trim();
    setNewMessage('');

    const socket = getSocket();

    // Reset typing status on send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (socket) {
      socket.emit('stop_typing', {
        chatId: request.chatId,
        senderId: resolvedCurrentUser.id,
        receiverId: request.mechanicId
      });

      // Emit cleanly over Socket
      socket.emit('send_message', {
        chatId: request.chatId,
        senderId: resolvedCurrentUser.id,
        senderRole: 'user',
        receiverId: request.mechanicId,
        message: textToSend
      });
    } else {
      // Fallback API route if connection fails
      try {
        const res = await fetch(`/api/chats/${request.chatId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ message: textToSend })
        });
        if (!res.ok) throw new Error('Message transmission failed.');
        const sentMsg = await res.json();
        setMessages(prev => prev.some(m => m.id === sentMsg.id) ? prev : [...prev, sentMsg]);
        scrollToBottom();
      } catch (err) {
        alert(err.message || 'Could not send message.');
      }
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

  // Load diagnostic details and check mechanic's initial status
  useEffect(() => {
    if (request?.mechanicId) {
      checkInitialMechanicStatus(request.mechanicId);
    }
  }, [request?.mechanicId]);

  // Socket subscribers effect
  useEffect(() => {
    if (!request?.chatId) return;

    fetchRequestMessages(request.chatId);

    let socket = getSocket();
    let reconnectInterval = null;
    let listenersAttached = false;
    let pollingInterval = null;

    const attachSocketListeners = (socketInstance) => {
      if (!socketInstance || listenersAttached) return;
      const activeSocket = socketInstance;
      socket = activeSocket;
      listenersAttached = true;

      if (resolvedCurrentUser.id) {
        activeSocket.emit('message_read', {
          chatId: request.chatId,
          readerId: resolvedCurrentUser.id
        });
      }

      activeSocket.on('receive_message', handleReceiveMessage);
      activeSocket.on('message_sent_confirm', handleConfirmMessage);
      activeSocket.on('typing', handleTyping);
      activeSocket.on('stop_typing', handleStopTyping);
      activeSocket.on('messages_marked_read', handleMarkedRead);
      activeSocket.on('user_status_change', handleStatusChange);
      activeSocket.on('room_joined', handleJoined);
    };

    const cleanupSocketListeners = () => {
      if (!socket || !listenersAttached) return;
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_sent_confirm', handleConfirmMessage);
      socket.off('typing', handleTyping);
      socket.off('stop_typing', handleStopTyping);
      socket.off('messages_marked_read', handleMarkedRead);
      socket.off('user_status_change', handleStatusChange);
      socket.off('room_joined', handleJoined);
      listenersAttached = false;
    };

    if (socket) {
      attachSocketListeners(socket);
    } else {
      reconnectInterval = setInterval(() => {
        const nextSocket = getSocket();
        if (nextSocket) {
          attachSocketListeners(nextSocket);
          if (reconnectInterval) clearInterval(reconnectInterval);
          reconnectInterval = null;
        }
      }, 500);
    }

    pollingInterval = setInterval(() => {
      if (request.chatId) fetchRequestMessages(request.chatId, true);
    }, 8000);

    const handleReceiveMessage = (msg) => {
      if (msg.chatId === request.chatId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();

        if (socket) {
          socket.emit('message_read', {
            chatId: request.chatId,
            messageId: msg.id,
            readerId: resolvedCurrentUser.id
          });
        }
      }
    };

    const handleConfirmMessage = (msg) => {
      if (msg.chatId === request.chatId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
    };

    const handleTyping = (data) => {
      if (data.chatId === request.chatId && data.senderId === request.mechanicId) {
        setIsMechanicTyping(true);
      }
    };

    const handleStopTyping = (data) => {
      if (data.chatId === request.chatId && data.senderId === request.mechanicId) {
        setIsMechanicTyping(false);
      }
    };

    const handleMarkedRead = (data) => {
      if (data.chatId === request.chatId) {
        setMessages(prev => prev.map(m => m.chatId === data.chatId ? { ...m, isRead: true } : m));
      }
    };

    const handleStatusChange = (data) => {
      if (request?.mechanicId && data.userId === request.mechanicId) {
        setIsMechanicOnline(data.status === 'online');
      }

      if (data.onlineUsers && request?.mechanicId) {
        setIsMechanicOnline(data.onlineUsers.includes(request.mechanicId));
      }
    };

    const handleJoined = (data) => {
      if (data.onlineUsers && request?.mechanicId) {
        setIsMechanicOnline(data.onlineUsers.includes(request.mechanicId));
      }
    };

    return () => {
      if (reconnectInterval) clearInterval(reconnectInterval);
      if (pollingInterval) clearInterval(pollingInterval);
      cleanupSocketListeners();
    };
  }, [request?.chatId, request?.mechanicId, resolvedCurrentUser.id]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-amber-500/10 border-amber-500/30 text-amber-500';
      case 'Accepted': return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'In Progress': return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400';
      case 'Completed': return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'Rejected': return 'bg-red-500/10 border-red-500/30 text-red-400';
      default: return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-40" id="user-chat-loader">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-650"></div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-xl mx-auto text-center" id="user-chat-error">
        <p className="text-red-400 text-sm mb-4 font-sans">⚠️ {error || 'Specified Repair Request could not be found.'}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 py-2 px-4 rounded-xl cursor-pointer font-sans"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const { vehicleDetails, mechanicDetails } = request;

  return (
    <div className="space-y-6" id="user-repair-chat-panel">
      {/* Back button Row */}
      <button
        onClick={() => navigate('/mechanics')}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer font-bold font-sans"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Mechanics Directory</span>
      </button>

      {/* Grid: Request details + Real-time Workspace Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="chat-session-deck">
        
        {/* LEFT COLUMN: REPAIR GENERAL OVERVIEW */}
        <div className="lg:col-span-4 space-y-4" id="repair-specs-sidebar">
          
          {/* Main Status & Info Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-start gap-2">
              <div>
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-sans">Issue Type</span>
                <h2 className="text-base font-extrabold text-white leading-snug">{request.damageType}</h2>
              </div>
              <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-full border font-mono ${getStatusColor(request.status)}`}>
                {request.status}
              </span>
            </div>

            {request.description && (
              <div className="border-t border-slate-800/80 pt-3">
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">User Statement</span>
                <p className="text-xs text-slate-300 italic font-sans">"{request.description}"</p>
              </div>
            )}

            <div className="border-t border-slate-800/80 pt-3 space-y-3 font-sans">
              {/* Vehicle Sub-details */}
              <div>
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1 font-sans">
                  <Car className="w-3 h-3" />
                  <span>Garaged Vehicle Details</span>
                </span>
                {vehicleDetails ? (
                  <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 space-y-1 text-xs">
                    <div className="font-extrabold text-slate-200">{vehicleDetails.make} {vehicleDetails.model}</div>
                    <div className="text-slate-500 font-mono text-[10px]">
                      {vehicleDetails.year} • Plate: {vehicleDetails.licensePlate} • Mileage: {vehicleDetails.mileage.toLocaleString()} mi
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">No vehicle info associated.</p>
                )}
              </div>

              {/* Shop Operator Details with Live Connection Badge */}
              <div>
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1 font-sans">
                  <Wrench className="w-3 h-3" />
                  <span>Workshop Operator</span>
                </span>
                {mechanicDetails ? (
                  <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 space-y-2 text-xs">
                    <div>
                      <div className="font-extrabold text-slate-200 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${isMechanicOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                        <span>{mechanicDetails.name}</span>
                      </div>
                      <div className="text-slate-500 text-[10px] mt-0.5">{mechanicDetails.address}</div>
                      <div className="text-slate-500 text-[10px] mt-0.5 font-sans font-normal">
                        ({isMechanicOnline ? '🟢 Online Now' : '⚪ Offline'})
                      </div>
                    </div>
                    {mechanicDetails.phone && (
                      <div className="text-[10px] text-emerald-400 font-bold select-all flex items-center gap-1 font-mono">
                        <span>📞</span>
                        <span>{mechanicDetails.phone}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">Assigned Mechanic details unavailable.</p>
                )}
              </div>
            </div>
          </div>

          {/* Guidelines info card */}
          <div className="bg-slate-900/40 border border-slate-800 p-4.5 rounded-2xl space-y-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Shield className="w-3.5 h-3.5 text-red-500" />
              <span>Real-time Workspace Secure</span>
            </h3>
            <p className="text-[10.5px] text-slate-500 leading-normal font-sans">
              Your communications and diagnostic evaluations are securely monitored. Please maintain clear communication and do not share any sensitive personal identifiers in open messaging channels.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE CHAT CONSOLE */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between overflow-hidden shadow-2xl h-[520px]" id="chat-terminal-view">
          
          {/* Header Bar */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isMechanicOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></div>
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                Direct Chat with Mechanic ({isMechanicOnline ? 'Online' : 'Offline'})
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              Real-time Socket Mode
            </span>
          </div>

          {/* Conversation Bubble Screen */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950/10 h-full" id="messages-deck">
            {messages.length === 0 ? (
              <div className="text-center py-24 text-slate-600 text-xs font-sans">
                No messaging items recorded. Submit an inquiry.
              </div>
            ) : (
              messages.map(m => {
                const isMe = m.senderRole === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[75%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                  >
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                        isMe
                          ? 'bg-red-650 text-white rounded-tr-none shadow-md'
                          : 'bg-slate-800 text-slate-200 border border-slate-750 rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap font-sans">{m.message}</p>
                      <div className={`text-[8.5px] mt-1 text-right block font-mono select-none flex items-center justify-end gap-1 ${isMe ? 'text-red-300' : 'text-slate-500'}`}>
                        <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && (
                          <span className={m.isRead ? 'text-emerald-400' : 'text-red-400'}>
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

          {/* Chat Form Input with Real-time Typing Notification */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/35 shrink-0">
            {isMechanicTyping && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono py-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping"></span>
                <span>Mechanic is typing...</span>
              </div>
            )}
            
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Enquire about diagnosis details, book times..."
                value={newMessage}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 text-slate-100 py-3 px-4 text-xs rounded-xl outline-none"
              />
              <button
                type="submit"
                className="bg-red-650 hover:bg-red-600 font-extrabold uppercase tracking-widest text-[11px] text-white py-3 px-5 rounded-xl cursor-pointer hover:shadow-lg transition flex items-center gap-1 active:scale-95 shrink-0"
              >
                <span>Send</span>
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
