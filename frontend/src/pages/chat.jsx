import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import './chat.css';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { getToken, clearAuthData } from '../utils/auth';

const ChatPage = () => {
    const navigate = useNavigate();  
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [conversations, setConversations] = useState([]);
    const messagesEndRef = useRef();
    const socketRef = useRef();
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    
    // Base URL from config
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

    // Fetch conversations
    const fetchConversations = async () => {
        console.log('Fetching conversations...');
        try {
            const token = getToken();
            if (!token) {
                clearAuthData();
                navigate('/login');
                return;
            }
            const response = await axios.get(`${API_BASE_URL}/conversations`, {
                headers: { 'x-auth-token': token }
            });
            console.log('Raw conversations data:', response.data);
            // Log the structure of the first conversation if available
            if (response.data && response.data.length > 0) {
                console.log('Sample conversation structure:', {
                    id: response.data[0]._id,
                    hasParticipants: !!response.data[0].participants,
                    participantsType: typeof response.data[0].participants,
                    isArray: Array.isArray(response.data[0].participants),
                    participants: response.data[0].participants
                });
            }
            setConversations(response.data);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        }
    };

    useEffect(() => {
        console.log('Initial useEffect triggered');
        const initializeChat = async () => {
            console.log('Starting chat initialization...');
            const token = getToken();
            if (!token) {
                console.log('No valid token found, redirecting to login');
                navigate('/login');
                return;
            }

            try {
                console.log('Initializing socket connection...');
                // Initialize socket connection
                socketRef.current = io(API_BASE_URL, {
                    auth: { token },
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000
                });

                // Socket event listeners
                socketRef.current.on('connect', () => {
                    console.log('Socket connected successfully');
                    socketRef.current.emit('join_conversations');
                });

                socketRef.current.on('connect_error', (error) => {
                    console.error('Socket connection error:', error);
                });

                socketRef.current.on('new_message', (message) => {
                    console.log('New message received:', message);
                    setMessages(prevMessages => {
                        // Remove optimistic message if it matches content, sender, and is recent
                        const filtered = prevMessages.filter(m => {
                            // If optimistic (string id), check content, sender, and time proximity
                            if (typeof m._id === 'string' && m._id.length < 20) {
                                return !(
                                    m.content === message.content &&
                                    m.sender._id === currentUser?._id &&
                                    Math.abs(new Date(m.createdAt) - new Date(message.createdAt)) < 60000 // 1 min
                                );
                            }
                            return m._id !== message._id;
                        });
                        // Add the real message if not already present
                        if (filtered.some(m => m._id === message._id)) {
                            return filtered;
                        }
                        return [...filtered, message];
                    });
                    fetchConversations();
                });

                socketRef.current.on('new_conversation', (conversation) => {
                    console.log('New conversation received:', conversation);
                    setConversations(prev => {
                        if (prev.some(c => c._id === conversation._id)) {
                            return prev;
                        }
                        return [...prev, conversation];
                    });
                });

                socketRef.current.on('messages_read', ({ conversationId: convId, userId }) => {
                    console.log('Messages read event:', convId, userId);
                    if (convId === conversationId) {
                        setMessages(prevMessages =>
                            prevMessages.map(msg =>
                                msg.sender._id !== userId && !msg.read
                                    ? { ...msg, read: true }
                                    : msg
                            )
                        );
                    }
                });

                console.log('Fetching user info...');
                // Fetch user info
                const response = await axios.get(`${API_BASE_URL}/user-info`, {
                    headers: { 'x-auth-token': token }
                });
                console.log('User info fetched:', response.data);
                setCurrentUser(response.data.user);
                
                console.log('Fetching conversations...');
                // Fetch conversations after getting user info
                await fetchConversations();
                
                console.log('All initialization complete, setting loading to false');
                setLoading(false);
            } catch (error) {
                console.error('Error during chat initialization:', error);
                clearAuthData();
                navigate('/login');
            }
        };

        initializeChat();

        // Cleanup socket connection
        return () => {
            console.log('Cleaning up socket connection');
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [navigate]);

    useEffect(() => {
        const fetchMessages = async () => {
            if (!conversationId) return;
            
        try {
            const token = getToken();
            if (!token) {
                clearAuthData();
                navigate('/login');
                return;
            }
            const response = await axios.get(`${API_BASE_URL}/messages/${conversationId}`, {
                headers: { 'x-auth-token': token }
            });
                setMessages(response.data);

                // Mark messages as read
                socketRef.current.emit('mark_read', { conversationId });
            } catch (error) {
                console.log("Error fetching messages:", error);
            }
        }
        fetchMessages();
    }, [conversationId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        try {
            const token = getToken();
            if (!token) {
                clearAuthData();
                navigate('/login');
                return;
            }
            const response = await axios.get(`${API_BASE_URL}/search-users?query=${query}`, {
                headers: { 'x-auth-token': token }
            });
            setSearchResults(response.data);
        } catch (error) {
            console.log('Error searching users:', error);
        }
    };

    const handleUserSelect = async (user) => {
        setSelectedUser(user);
        setSearchQuery('');
        setSearchResults([]);

        try {
            const token = getToken();
            if (!token) {
                clearAuthData();
                navigate('/login');
                return;
            }
            
            // First, check if a conversation already exists
            const existingConversation = conversations.find(conv => 
                !conv.isGroup && 
                conv.participant && 
                conv.participant._id === user._id
            );

            if (existingConversation) {
                setConversationId(existingConversation._id);
                return;
            }

            // If no existing conversation, create a new one
            const response = await axios.post(
                `${API_BASE_URL}/conversations`,
                {
                    participants: [user._id],
                    isGroup: false
                },
                {
                    headers: { 'x-auth-token': token }
                }
            );
            setConversationId(response.data._id);
            
            // Join the conversation room
            socketRef.current.emit('join_conversations');
        } catch (error) {
            console.log('Error creating conversation:', error);
        }
    };

    const handleEmojiSelect = (emoji) => {
        setNewMessage(prev => prev + (emoji.native || ''));
        setShowEmojiPicker(false);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage || !conversationId) return;
        
        try {
            // Emit message through socket
            socketRef.current.emit('send_message', {
                conversationId,
                content: newMessage
            });
            
            // Optimistically add message to UI
            const optimisticMessage = {
                _id: Date.now().toString(), // Temporary ID
                conversation: conversationId,
                sender: currentUser,
                content: newMessage,
                read: false,
                createdAt: new Date().toISOString()
            };
            
            setMessages(prevMessages => [...prevMessages, optimisticMessage]);
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleLogout = () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
        clearAuthData();
        navigate('/login');
    };

    console.log('Current loading state:', loading);
    if (loading) {
        console.log('Rendering loading screen');
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>Loading chat...</p>
            </div>
        );
    }

    console.log('Rendering chat interface');
    return (
        <div className="chat-container">
            <div className="chat-sidebar">
                <div className="user-profile" style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderRadius: '0.5rem'}}>
                    <div className="user-avatar">{currentUser?.name?.charAt(0)}</div>
                    <span style={{fontWeight: 600}}>{currentUser?.name}</span>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
                <div className="sidebar-header">
                    <h2>Chat</h2>
                </div>
                
                <div className="search-container">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearch}
                        placeholder="Search users..."
                        className="search-input"
                    />
                    {searchResults.length > 0 && (
                        <div className="search-results">
                            {searchResults.map(user => (
                                <div
                                    key={user._id}
                                    className="search-result-item"
                                    onClick={() => handleUserSelect(user)}
                                >
                                    <div className="user-avatar">{user.name.charAt(0)}</div>
                                    <div className="user-info">
                                        <h3>{user.name}</h3>
                                        <p>{user.email}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="conversations-list">
                    {(() => {
                        // Build a map: participantId -> {participant, lastMessage, updatedAt, conversationId}
                        const userMap = new Map();
                        conversations.forEach(conversation => {
                            if (!conversation || !conversation.participant || !conversation.participant._id) return;
                            const id = conversation.participant._id;
                            // If this user is not in the map or this conversation is newer, update the map
                            if (!userMap.has(id) || new Date(conversation.updatedAt) > new Date(userMap.get(id).updatedAt)) {
                                userMap.set(id, {
                                    participant: conversation.participant,
                                    lastMessage: conversation.lastMessage,
                                    updatedAt: conversation.updatedAt,
                                    conversationId: conversation._id
                                });
                            }
                        });
                        // Convert map to array and sort by updatedAt desc
                        const grouped = Array.from(userMap.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                        return grouped.map(({participant, lastMessage, conversationId, updatedAt}, idx) => {
                            // Find the full conversation object for this conversationId
                            const fullConversation = conversations.find(c => c._id === conversationId);
                            // Debug output
                            console.log('Sidebar conversation:', {
                                participant,
                                lastMessage,
                                lastMessageSenderId: fullConversation?.lastMessageSenderId,
                                currentUserId: currentUser?._id,
                                conversationId
                            });
                            return (
                                <div
                                    key={participant._id}
                                    className={`conversation-item ${selectedUser?._id === participant._id ? 'active' : ''}`}
                                    onClick={() => handleUserSelect(participant)}
                                >
                                    <div className="user-avatar">
                                        {participant.name ? participant.name.charAt(0) : '?'}
                                    </div>
                                    <div className="conversation-info">
                                        <h3>{participant.name || 'Unknown User'}</h3>
                                        <p className="last-message">
                                            {(() => {
                                                if (selectedUser && participant._id === selectedUser._id && messages.length > 0) {
                                                    const lastMsg = messages[messages.length - 1];
                                                    if (lastMsg && lastMsg.sender && String(lastMsg.sender._id) === String(currentUser?._id)) {
                                                        return <><strong>You: </strong>{lastMsg.content}</>;
                                                    } else if (lastMsg) {
                                                        return <>{lastMsg.content}</>;
                                                    } else {
                                                        return <>No messages yet</>;
                                                    }
                                                } else {
                                                    if (lastMessage && fullConversation && fullConversation.lastMessageSenderId && String(fullConversation.lastMessageSenderId) === String(currentUser?._id)) {
                                                        return <><strong>You: </strong>{lastMessage}</>;
                                                    } else if (lastMessage) {
                                                        return <>{lastMessage}</>;
                                                    } else {
                                                        return <>No messages yet</>;
                                                    }
                                                }
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>
            
            <div className="chat-main">
                {selectedUser ? (
                    <>
                        <div className="chat-header">
                            <div className="user-profile-header" style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                                <div className="user-avatar">{selectedUser.name.charAt(0)}</div>
                                <div className="user-info">
                                    <h3>{selectedUser.name}</h3>
                                </div>
                            </div>
                        </div>
                        
                        <div className="messages-container">
                            {messages.map(message => (
                                <div
                                    key={message._id}
                                    className={`message ${message.sender._id === currentUser?._id ? 'sent' : 'received'}`}
                                >
                                    {/* {message.sender._id !== currentUser?._id && (
                                        <div className="user-avatar" style={{marginRight: '0.5rem'}}>
                                            {message.sender.name.charAt(0)}
                                        </div>
                                    )} */}
                                    <div className="message-bubble-wrapper">
                                        <div className="message-content no-border">{message.content}</div>
                                        <div className="message-time">
                                            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        
                        <form onSubmit={handleSendMessage} className="message-form">
                            <button 
                                type="button" 
                                className="emoji-button"
                                onClick={() => setShowEmojiPicker(prev => !prev)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', marginRight: '0.5rem' }}
                            >
                                😊
                            </button>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                className="message-input"
                            />
                            <button type="submit" className="send-button">
                                ➤
                            </button>
                            {showEmojiPicker && (
                                <div style={{ position: 'absolute', bottom: '60px', right: '1rem', zIndex: 1000 }}>
                                    <Picker data={data} onEmojiSelect={handleEmojiSelect} />
                                </div>
                            )}
                        </form>
                    </>
                ) : (
                    <div className="no-chat-selected">
                        <h2>Select a conversation to start chatting</h2>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatPage;