const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createServer } = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Import auth middleware
const authMiddleware = require('./middleware/auth');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173", // Vite's default port
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8001;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Stop the server if DB fails to connect
  });

// Socket.IO connection handling
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return next(new Error('User not found'));
        }

        socket.user = user;
        next();
    } catch (error) {
        next(new Error('Authentication error'));
    }
});

// Store user socket mappings
const userSockets = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.user.name);
    
    // Store socket mapping
    userSockets.set(socket.user._id.toString(), socket.id);

    // Join user's conversations
    socket.on('join_conversations', async () => {
        try {
            const conversations = await Conversation.find({
                participants: socket.user._id
            });
            conversations.forEach(conv => {
                socket.join(conv._id.toString());
            });
        } catch (error) {
            console.error('Error joining conversations:', error);
        }
    });

    // Handle new messages
    socket.on('send_message', async (data) => {
        try {
            const { conversationId, content } = data;
            
            // Verify user is part of conversation
            const conversation = await Conversation.findOne({
                _id: conversationId,
                participants: socket.user._id
            });

            if (!conversation) {
                return;
            }

            // Create new message
            const newMessage = new Message({
                conversation: conversationId,
                sender: socket.user._id,
                content,
                read: false
            });

            await newMessage.save();
            await newMessage.populate('sender', 'name email');

            // Update conversation
            conversation.lastMessage = content;
            conversation.updatedAt = Date.now();
            await conversation.save();

            // Get all participants' socket IDs
            const participantSockets = conversation.participants
                .map(p => p.toString())
                .filter(id => id !== socket.user._id.toString())
                .map(id => userSockets.get(id))
                .filter(Boolean);

            // Emit to all participants
            if (participantSockets.length > 0) {
                io.to(participantSockets).emit('new_message', newMessage);
            }
            
            // Also emit to the sender's other tabs/windows
            socket.to(conversationId).emit('new_message', newMessage);
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    // Handle message read status
    socket.on('mark_read', async (data) => {
        try {
            const { conversationId } = data;
            await Message.updateMany(
                {
                    conversation: conversationId,
                    sender: { $ne: socket.user._id },
                    read: false
                },
                { read: true }
            );

            // Get the other participant's socket ID
            const conversation = await Conversation.findById(conversationId);
            if (conversation) {
                const otherParticipantId = conversation.participants
                    .find(p => p.toString() !== socket.user._id.toString())
                    ?.toString();
                
                if (otherParticipantId) {
                    const otherSocketId = userSockets.get(otherParticipantId);
                    if (otherSocketId) {
                        io.to(otherSocketId).emit('messages_read', {
                            conversationId,
                            userId: socket.user._id
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.user.name);
        userSockets.delete(socket.user._id.toString());
    });
});

app.get('/', (req, res) => {
  res.send('API is running');
});

app.post('/register', async (req, res) => {
  const { name, email, mobileno, password } = req.body;

  if (!name || !email || !mobileno || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const user = new User({ name, email, mobileno, password });
    await user.save();

    res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '15d' });

    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Google Authentication endpoint
app.post('/auth/google', async (req, res) => {
  const { firebaseToken, name, email, photoURL } = req.body;

  if (!firebaseToken) {
    return res.status(400).json({ success: false, message: 'Firebase token is required' });
  }

  try {
    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    const firebaseUid = decodedToken.uid;
    const firebaseEmail = decodedToken.email || email;

    // Check if user already exists
    let user = await User.findOne({ email: firebaseEmail });

    if (!user) {
      // Create new user for Google sign-in (no password required)
      user = new User({
        name: name || decodedToken.name || 'Google User',
        email: firebaseEmail,
        mobileno: '', // Optional for Google users
        firebaseUid: firebaseUid,
        photoURL: photoURL || decodedToken.picture,
        authProvider: 'google'
      });
      await user.save();
    } else {
      // Update existing user with Firebase info if not already set
      if (!user.firebaseUid) {
        user.firebaseUid = firebaseUid;
        user.authProvider = 'google';
        if (photoURL) user.photoURL = photoURL;
        await user.save();
      }
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '15d' });

    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, photoURL: user.photoURL }
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(401).json({ success: false, message: 'Invalid Firebase token' });
  }
});

// Fixed req/res parameter order
app.get('/user-info', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.log("Error fetching user info:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fixed req/res parameter order and populate path
app.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const conversations = await Conversation.find({
      participants: userId
    }).populate({
      path: 'participants',
      select: 'name email',
      match: { _id: { $ne: userId } }
    });
    // For each conversation, fetch the last message and its sender
    const formattedConversations = await Promise.all(conversations.map(async conv => {
      let lastMessageSenderId = null;
      let lastMessage = conv.lastMessage;
      // Always get the latest message by createdAt
      const lastMsg = await Message.findOne({ conversation: conv._id })
        .sort({ createdAt: -1 })
        .select('sender content');
      if (lastMsg) {
        lastMessageSenderId = lastMsg.sender;
        lastMessage = lastMsg.content;
      }
      const isGroup = conv.isGroup;
      return {
        _id: conv._id,
        isGroup: isGroup,
        name: conv.name,
        participant: isGroup ? null : conv.participants[0],
        lastMessage: lastMessage,
        lastMessageSenderId: lastMessageSenderId,
        updatedAt: conv.updatedAt
      };
    }));
    res.json(formattedConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/messages/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    
    // Check if user is part of this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });
    
    if (!conversation) {
      return res.status(403).json({ message: 'Not authorized to access this conversation' });
    }
    
    // Get messages
    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'name email')
      .sort('createdAt');
    
    // Mark messages as read
    await Message.updateMany(
      { 
        conversation: conversationId, 
        sender: { $ne: userId },
        read: false
      },
      { read: true }
    );
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/messages', authMiddleware, async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const userId = req.user.userId;
    
    // Check if user is part of this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });
    
    if (!conversation) {
      return res.status(403).json({ message: 'Not authorized to send messages to this conversation' });
    }
    
    // Create new message
    const newMessage = new Message({
      conversation: conversationId,
      sender: userId,
      content,
      read: false
    });
    
    await newMessage.save();
    
    // Update conversation with last message
    conversation.lastMessage = content;
    conversation.updatedAt = Date.now();
    await conversation.save();
    
    // Populate sender info before sending response
    await newMessage.populate('sender', 'name email');
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/conversations', authMiddleware, async (req, res) => {
  try {
    const { participants, isGroup, name } = req.body;
    const userId = req.user.userId;
    
    // Make sure current user is included in participants
    if (!participants.includes(userId)) {
      participants.push(userId);
    }
    
    // Create new conversation
    const newConversation = new Conversation({
      participants,
      isGroup,
      name: isGroup ? name : undefined,
      createdBy: userId
    });
    
    await newConversation.save();
    
    // Populate participant info before sending response
    await newConversation.populate({
      path: 'participants',
      select: 'name email'
    });
    
    res.status(201).json(newConversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new endpoint to search users
app.get('/search-users', authMiddleware, async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.userId;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const users = await User.find({
      _id: { $ne: userId }, // Exclude current user
      name: { $regex: query, $options: 'i' } // Case-insensitive search
    }).select('name email');

    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change app.listen to httpServer.listen
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.get('/messages/between/:userId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId; // current user
    const otherUserId = req.params.userId;

    // Find all conversations between these two users (not group)
    const conversations = await Conversation.find({
      isGroup: false,
      participants: { $all: [userId, otherUserId], $size: 2 }
    });

    const conversationIds = conversations.map(conv => conv._id);

    // Find all messages in these conversations
    const messages = await Message.find({
      conversation: { $in: conversationIds }
    })
      .populate('sender', 'name email')
      .sort('createdAt');

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages between users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});