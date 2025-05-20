import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import './chat.css';

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
    const messagesEndRef = useRef();
    const socketRef = useRef();
    
    // Base URL for consistency
    const API_BASE_URL = 'http://localhost:8001';

    useEffect(() => {
        const token = localStorage.getItem('chatToken');
        if (!token) {
            navigate('/login');
            return;
        }

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
            console.log('Connected to socket server');
            socketRef.current.emit('join_conversations');
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        socketRef.current.on('new_message', (message) => {
            console.log('New message received:', message);
            setMessages(prevMessages => {
                // Check if message already exists
                if (prevMessages.some(m => m._id === message._id)) {
                    return prevMessages;
                }
                return [...prevMessages, message];
            });
        });

        socketRef.current.on('messages_read', ({ conversationId: convId, userId }) => {
            console.log('Messages read:', convId, userId);
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

        const fetchUserInfo = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/user-info`, {
                    headers: { 'x-auth-token': token }
                });
                setCurrentUser(response.data.user);
            } catch (error) {
                console.log('Error fetching user info:', error);
                localStorage.removeItem('chatToken');
                navigate('/login');
            } finally {
                setLoading(false);
            }
        }

        fetchUserInfo();

        // Cleanup socket connection
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [navigate]);

    useEffect(() => {
        const fetchMessages = async () => {
            if (!conversationId) return;
            
            try {
                const token = localStorage.getItem('chatToken');
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
            const token = localStorage.getItem('chatToken');
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
            const token = localStorage.getItem('chatToken');
            // Create or get existing conversation
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
        localStorage.removeItem('chatToken');
        navigate('/login');
    };

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="chat-container">
            <div className="chat-sidebar">
                <div className="sidebar-header">
                    <h2>Chat</h2>
                    <div className="user-info">
                        <span>{currentUser?.name}</span>
                        <button onClick={handleLogout} className="logout-btn">Logout</button>
                    </div>
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
            </div>
            
            <div className="chat-main">
                {selectedUser ? (
                    <>
                        <div className="chat-header">
                            <h2>{selectedUser.name}</h2>
                        </div>
                        
                        <div className="messages-container">
                            {messages.length === 0 ? (
                                <div className="no-messages">No messages yet. Start the conversation!</div>
                            ) : (
                                messages.map(message => (
                                    <div 
                                        key={message._id}
                                        className={`message ${message.sender._id === currentUser._id ? 'sent' : 'received'}`}
                                    >
                                        <div className="message-content">{message.content}</div>
                                        <div className="message-time">
                                            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {message.read && message.sender._id === currentUser._id && 
                                                <span className="read-receipt">✓</span>}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        
                        <form className="message-form" onSubmit={handleSendMessage}>
                            <input 
                                type="text" 
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                className="message-input"
                            />
                            <button type="submit" className="send-button">Send</button>
                        </form>
                    </>
                ) : (
                    <div className="no-chat-selected">
                        <h2>Search for a user to start chatting</h2>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatPage;