// MechanicRequests.js
import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, MessageCircle, Play, CheckCircle, XCircle } from 'lucide-react';
import { getSocket } from '../socket';

export default function MechanicRequests({ token, currentUser }) {
  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Socket presence/typing states
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [customerTyping, setCustomerTyping] = useState(false);

  const resolvedCurrentUser = currentUser || JSON.parse(sessionStorage.getItem('autoaid_user') || '{}');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const fetchRequests = async (silent = false) => {
    try {
      const res = await fetch('/api/repair-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Could not pull repair tickets ledger.');
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error('Error loading request ledger:', err);
    } finally {
      if (!silent) setLoading(false);
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
      console.error('Error fetching online user list:', err);
    }
  };

  const fetchMessagesOfRequest = async (chatId, silent = false) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve messages list.');
      const data = await res.json();
      setMessages(data);
      if (!silent) {
        scrollToBottom();
      }
    } catch (err) {
      console.error('Msg load error:', err);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedRequestId) return;
    setSubmittingStatus(true);
    try {
      const res = await fetch(`/api/repair-requests/${selectedRequestId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update request state.');
      }
      await fetchRequests(true);
    } catch (err) {
      alert(err.message || 'State modification failed.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const isSamePendingLocalMessage = (localMsg, confirmedMsg) => {
    return localMsg.id?.startsWith('local_') &&
      localMsg.chatId === confirmedMsg.chatId &&
      localMsg.senderId === confirmedMsg.senderId &&
      localMsg.receiverId === confirmedMsg.receiverId &&
      localMsg.message === confirmedMsg.message;
  };

  // Emit typing status to customer
  const handleInputChange = (text) => {
    setReplyText(text);

    const activeReq = requests.find(r => r.id === selectedRequestId);
    const socket = getSocket();
    if (!socket || !activeReq?.chatId || !activeReq?.userId) return;

    socket.emit('typing', {
      chatId: activeReq.chatId,
      senderId: resolvedCurrentUser.id,
      receiverId: activeReq.userId
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', {
        chatId: activeReq.chatId,
        senderId: resolvedCurrentUser.id,
        receiverId: activeReq.userId
      });
    }, 1500);
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    const activeReq = requests.find(r => r.id === selectedRequestId);
    if (!replyText.trim() || !activeReq?.chatId || !activeReq?.userId) return;

    const textToSend = replyText.trim();
    setReplyText('');

    const socket = getSocket();

    // Clear local typing timeout and emit stop_typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (socket) {
      socket.emit('stop_typing', {
        chatId: activeReq.chatId,
        senderId: resolvedCurrentUser.id,
        receiverId: activeReq.userId
      });

      // Optimistically render the outgoing message immediately
      const optimisticMsg = {
        id: `local_${Date.now()}`,
        chatId: activeReq.chatId,
        senderId: resolvedCurrentUser.id,
        senderRole: 'mechanic',
        receiverId: activeReq.userId,
        message: textToSend,
        timestamp: new Date().toISOString(),
        isRead: true,
      };
      setMessages(prev => [...prev, optimisticMsg]);
      scrollToBottom();

      // Send cleanly over Socket
      socket.emit('send_message', {
        chatId: activeReq.chatId,
        senderId: resolvedCurrentUser.id,
        senderRole: 'mechanic',
        receiverId: activeReq.userId,
        message: textToSend
      });
    } else {
      // Fallback REST path
      try {
        const res = await fetch(`/api/chats/${activeReq.chatId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ message: textToSend })
        });
        if (!res.ok) throw new Error('Message reply failed to transmit.');
        const data = await res.json();
        setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);
        scrollToBottom();
      } catch (err) {
        alert(err.message || 'Could not post message replies.');
      }
    }
  };

  // Initial downloads
  useEffect(() => {
    fetchRequests();
    fetchOnlineUsers();
  }, [token]);

  // Lazy 15s sync fallback for robustness
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRequests(true);
      fetchOnlineUsers();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const activeRequest = requests.find(r => r.id === selectedRequestId);

  // Select request handlers and typing/receipt socket listeners
  useEffect(() => {
    if (!activeRequest?.chatId) {
      setMessages([]);
      return;
    }

    fetchMessagesOfRequest(activeRequest.chatId);

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
          chatId: activeRequest.chatId,
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
      fetchMessagesOfRequest(activeRequest.chatId, true);
    }, 8000);

    return () => {
      if (reconnectInterval) clearInterval(reconnectInterval);
      if (pollingInterval) clearInterval(pollingInterval);
      cleanupSocketListeners();
    };

    function handleReceiveMessage(msg) {
      if (msg.chatId === activeRequest.chatId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();

        if (socket) {
          socket.emit('message_read', {
            chatId: activeRequest.chatId,
            messageId: msg.id,
            readerId: resolvedCurrentUser.id
          });
        }
      }
    }

    function handleConfirmMessage(msg) {
      if (msg.chatId === activeRequest.chatId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          const withoutLocalCopy = prev.filter(m => !isSamePendingLocalMessage(m, msg));
          return [...withoutLocalCopy, msg];
        });
        scrollToBottom();
      }
    }

    function handleTyping(data) {
      if (data.chatId === activeRequest.chatId && data.senderId === activeRequest.userId) {
        setCustomerTyping(true);
      }
    }

    function handleStopTyping(data) {
      if (data.chatId === activeRequest.chatId && data.senderId === activeRequest.userId) {
        setCustomerTyping(false);
      }
    }

    function handleMarkedRead(data) {
      if (data.chatId === activeRequest.chatId) {
        setMessages(prev => prev.map(m => m.chatId === data.chatId ? { ...m, isRead: true } : m));
      }
    }

    function handleStatusChange(data) {
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
    }

    function handleJoined(data) {
      if (data.onlineUsers) {
        setOnlineUsers(new Set(data.onlineUsers));
      }
    }
  }, [selectedRequestId, activeRequest?.chatId, activeRequest?.userId, resolvedCurrentUser.id]);

  // Derived statistics for metrics
  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === 'Pending').length;
  const acceptedRequests = requests.filter(r => r.status === 'Accepted').length;
  const activeChatsCount = requests.filter(r => r.chatId).length;

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-amber-500/10 border-amber-500/30 text-amber-500';
      case 'Accepted': return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'In Progress': return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400';
      case 'Completed': return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'Rejected': return 'bg-red-500/10 border-red-500/30 text-red-500';
      default: return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
    }
  };

  return (
    <div className="space-y-6" id="mechanic-dashboard-panel">
      {/* Top Title */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-white tracking-tight">Mechanic Operations Portal</h1>
        <p className="text-xs text-slate-400">Manage dispatch calls, request statuses, vehicles diagnostic assessments, and real-time support channels.</p>
      </div>

      {/* SIDEBAR STATISTICS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="mechanic-kpis-deck">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Total Requests</span>
          <span className="text-xl font-black font-mono text-slate-100">{totalRequests}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="block text-[9px] text-amber-500 font-extrabold uppercase tracking-wider">Pending Requests</span>
          <span className="text-xl font-black font-mono text-amber-400">{pendingRequests}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="block text-[9px] text-blue-400 font-extrabold uppercase tracking-wider">Accepted Requests</span>
          <span className="text-xl font-black font-mono text-blue-400">{acceptedRequests}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="block text-[9px] text-emerald-400 font-extrabold uppercase tracking-wider">Active Chats</span>
          <span className="text-xl font-black font-mono text-emerald-400">{activeChatsCount}</span>
        </div>
      </div>

      {/* SPLIT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dispatch-board-interface">
        
        {/* LEFT COLUMN: REQUESTS LEDGER LIST */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[520px]" id="dispatch-ledger-rail">
          <div className="p-4 border-b border-slate-800 bg-slate-950/20 text-xs font-black uppercase tracking-wider text-slate-400 shrink-0">
            Incoming Requests Ledger ({requests.length})
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-950" id="requests-scroller">
            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-red-650 mx-auto"></div>
              </div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No dispatch repair requests logged.
              </div>
            ) : (
              requests.map((r) => {
                const isSelected = r.id === selectedRequestId;
                const isUserOnline = onlineUsers.has(r.userId);
                
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRequestId(r.id)}
                    className={`w-full text-left p-4 transition-all focus:outline-none flex flex-col gap-1 cursor-pointer ${
                      isSelected ? 'bg-slate-850 border-l-4 border-red-500' : 'hover:bg-slate-850/40'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-extrabold text-xs text-white truncate max-w-[120px] flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isUserOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                        <span>{r.userDetails?.name || 'Customer'}</span>
                      </span>
                      <span className={`text-[8.5px] uppercase font-black px-1.5 py-0.5 rounded border ${getStatusColor(r.status)}`}>
                        {r.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono">
                      🚙 {r.vehicleDetails?.make} {r.vehicleDetails?.model} ({r.vehicleDetails?.year})
                    </div>
                    
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300">
                        🔨 {r.damageType}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        📍 {r.distance || '1.2 km'} away
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE OPERATION CANVAS */}
        <div className="lg:col-span-8 flex flex-col justify-between" id="dispatch-canvas-display">
          
          {activeRequest ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full" id="active-request-layout">
              
              {/* Request info + actions (Left) */}
              <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* Customer Information segment */}
                  <div>
                    <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-wider mb-1">Customer Info</span>
                    <div className="text-xs font-black text-white flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full inline-block shrink-0 ${onlineUsers.has(activeRequest.userId) ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                      <span>{activeRequest.userDetails?.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-450 mt-0.5">
                      Status: <strong className={onlineUsers.has(activeRequest.userId) ? 'text-emerald-400' : 'text-slate-400'}>
                        {onlineUsers.has(activeRequest.userId) ? '🟢 Online' : 'Offline'}
                      </strong>
                    </div>
                    <div className="text-[10px] text-slate-500 select-all font-mono mt-0.5">{activeRequest.userDetails?.email}</div>
                  </div>

                  {/* Vehicle Information segment */}
                  <div className="border-t border-slate-800/80 pt-3">
                    <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-wider mb-1">Vehicle Details</span>
                    {activeRequest.vehicleDetails ? (
                      <div className="text-xs space-y-0.5 text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                        <div className="font-extrabold text-white">
                          {activeRequest.vehicleDetails.make} {activeRequest.vehicleDetails.model} ({activeRequest.vehicleDetails.year})
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">Plate: {activeRequest.vehicleDetails.licensePlate}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Mileage: {activeRequest.vehicleDetails.mileage.toLocaleString()} mi</div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 font-mono">No registered vehicle linked</span>
                    )}
                  </div>

                  {/* Damage & Description Details */}
                  <div className="border-t border-slate-800/80 pt-3 space-y-1.5">
                    <div>
                      <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Damage Type</span>
                      <span className="text-xs font-bold text-red-400">{activeRequest.damageType}</span>
                    </div>
                    {activeRequest.description && (
                      <div>
                        <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Description</span>
                        <p className="text-[11px] text-slate-300 leading-normal italic bg-slate-950 p-2 rounded-lg">"{activeRequest.description}"</p>
                      </div>
                    )}
                    
                    {/* Damage Assessment Visual */}
                    <div className="pt-1.5">
                      <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-wider mb-1">Uploaded Damage Assortment</span>
                      <div className="h-20 bg-slate-950 border border-slate-850 rounded-xl overflow-hidden flex items-center justify-center relative group">
                        <div className="absolute inset-0 bg-red-600/10"></div>
                        <span className="text-[11px] font-mono text-red-400/90 font-bold tracking-tight absolute">DIAGNOSTIC REPORT GRAPH 📊</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* WORKFLOW STATUS MANAGEMENT */}
                <div className="border-t border-slate-800/80 pt-3 space-y-2 shrink-0">
                  <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-wider mb-1">Update Status</span>
                  
                  {activeRequest.status === 'Pending' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleUpdateStatus('Accepted')}
                        disabled={submittingStatus}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[10px] uppercase py-2 px-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <ShieldCheck className="w-3" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('Rejected')}
                        disabled={submittingStatus}
                        className="bg-slate-800 hover:bg-slate-700 hover:text-red-400 text-slate-400 font-extrabold text-[10px] uppercase py-2 px-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <XCircle className="w-3" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}

                  {activeRequest.status === 'Accepted' && (
                    <button
                      onClick={() => handleUpdateStatus('In Progress')}
                      disabled={submittingStatus}
                      className="w-full bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-[10px] uppercase py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition"
                    >
                      <Play className="w-3" />
                      <span>Start Repair Work</span>
                    </button>
                  )}

                  {activeRequest.status === 'In Progress' && (
                    <button
                      onClick={() => handleUpdateStatus('Completed')}
                      disabled={submittingStatus}
                      className="w-full bg-emerald-650 hover:bg-emerald-600 text-white font-extrabold text-[10px] uppercase py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition"
                    >
                      <CheckCircle className="w-3" />
                      <span>Mark Completed</span>
                    </button>
                  )}

                  {activeRequest.status === 'Completed' && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-center py-2 px-2 text-[10px] font-bold uppercase rounded-lg">
                      🟢 Repair request has been fully completed
                    </div>
                  )}

                  {activeRequest.status === 'Rejected' && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-center py-2 px-2 text-[10px] font-bold uppercase rounded-lg">
                      🔴 This repair request was declined
                    </div>
                  )}
                </div>

              </div>

              {/* Chat Module Panel */}
              <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between overflow-hidden shadow-2xl h-[470px] md:h-full" id="mechanic-chat-pane">
                
                {/* Chat Header */}
                <div className="p-3 border-b border-slate-800 bg-slate-950/20 flex justify-between items-center shrink-0">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest font-sans flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Customer Chat Console ({onlineUsers.has(activeRequest.userId) ? '🟢 Online' : '⚪ Offline'})</span>
                  </span>
                  <span className="bg-slate-850 text-[9px] font-mono text-slate-400 py-0.5 px-2 rounded-md">
                    Real-time
                  </span>
                </div>

                {/* Message display zone */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/10 max-h-[350px] md:max-h-[380px]" id="messages-deck">
                  {messages.length === 0 ? (
                    <div className="text-center py-20 text-slate-600 text-xs">
                      No message exchange logged. Say hello.
                    </div>
                  ) : (
                    messages.map(m => {
                      const isMe = m.senderRole === 'mechanic';
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col max-w-[80%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                        >
                          <div
                            className={`p-3 rounded-2xl text-[11px] leading-relaxed ${
                              isMe
                                ? 'bg-indigo-650 text-white rounded-tr-none'
                                : 'bg-slate-800 text-slate-200 border border-slate-750/50 rounded-tl-none'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{m.message}</p>
                            <span className={`text-[8px] mt-0.5 font-mono text-slate-405 block text-right select-none flex items-center justify-end gap-1 ${isMe ? 'text-indigo-300' : 'text-slate-500'}`}>
                              <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isMe && (
                                <span className={m.isRead ? 'text-emerald-400' : 'text-slate-400'}>
                                  {m.isRead ? '✔✔' : '✔'}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message form reply */}
                <div className="p-3 border-t border-slate-800 bg-slate-950/20 shrink-0">
                  {customerTyping && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono pb-1.5 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping"></span>
                      <span>Customer is typing...</span>
                    </div>
                  )}
                  
                  <form onSubmit={handleSendReply} className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Provide quotation detail, schedules..."
                      value={replyText}
                      onChange={(e) => handleInputChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 text-slate-100 py-2 px-3 text-xs rounded-xl outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-[10px] uppercase tracking-wider py-2 px-4 rounded-xl cursor-pointer transition active:scale-95 shrink-0"
                    >
                      Reply
                    </button>
                  </form>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3" id="mechanic-blank-deck">
              <span className="text-3xl select-none">🛠️</span>
              <h4 className="font-extrabold text-sm text-slate-300">No active dispatch ticket chosen</h4>
              <p className="text-xs text-slate-500 max-w-sm leading-normal">
                Click a user call entry on the left-side requests ledger to inspect damage classifications, registered vehicles, and respond.
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
