import express, { json, urlencoded } from 'express';
import { hash as _hash } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import conn from './DB/connsection.js';
import Users from './models/user.js';
import Conversation from './models/Conversations.js';
import Message from './models/Message.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

// Middlewares
app.use(json());
app.use(urlencoded({ extended: false }));
const allowedOrigins = [
  'https://pingme-eta.vercel.app',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin like mobile apps or curl
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('CORS not allowed for this origin'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors()); // pre-flight for all routes

// Socket.IO setup (listens on port 8080 separately)
const io = new Server(8080, {
  cors: {
    origin: ['https://pingme-eta.vercel.app', 'http://localhost:5173'],
    credentials: true
  }
});

let users = [];
let onlineUsers = new Map();

io.on("connection", (socket) => {
  socket.on("addUser", (userId) => {
    if (!users.some((user) => user.userId === userId)) {
      users.push({ userId, socketId: socket.id });
    }
    io.emit("getUser", users);
  });

  socket.on("sendMessage", ({ senderId, receiverId, message, conversationId }) => {
    const receiver = users.find((user) => user.userId === receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit("getMessage", {
        senderId,
        receiverId,
        message,
        conversationId,
      });
    }
  });

  socket.on("user_online", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("update_online_users", Array.from(onlineUsers.keys()));
  });

  socket.on("disconnect", () => {
    for (let [userId, socketId] of onlineUsers) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    io.emit("update_online_users", Array.from(onlineUsers.keys()));
  });
});

// Routes
app.get('/', (req, res) => {
  res.send('PingMe API running...');
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await Users.find().select('_id username email');
    res.send(users);
  } catch (error) {
    res.status(500).send({ error: 'Failed to retrieve users' });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).send('All fields are required');
    }

    const isAlreadyExist = await Users.findOne({ email });
    if (isAlreadyExist) {
      return res.status(400).send('User already exists');
    }

    const newUser = new Users({ username, email });
    _hash(password, 10, async (err, hash) => {
      if (err) return res.status(500).send('Password hashing failed');

      newUser.password = hash;
      await newUser.save();
      res.status(200).send('User signed up successfully');
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('Email and password required');

    const user = await Users.findOne({ email });
    if (!user) return res.status(400).send('User not found');

    const payload = { userId: user._id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'default_secret_key', {
      expiresIn: '24h',
    });

    user.token = token;
    await user.save();

    res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      },
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.post('/api/conversation', async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    const existingConversation = await Conversation.findOne({
      members: { $all: [senderId, receiverId] }
    });

    if (existingConversation) {
      return res.status(200).json({ message: 'Conversation already exists', conversation: existingConversation });
    }

    const newConversation = new Conversation({ members: [senderId, receiverId] });
    await newConversation.save();
    res.status(201).json({ message: 'Conversation created', conversation: newConversation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

app.get('/api/conversation/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const conversations = await Conversation.find({ members: userId });

    const conversationUserData = await Promise.all(
      conversations.map(async (conversation) => {
        const receiverId = conversation.members.find(
          (member) => member.toString() !== userId
        );
        const user = await Users.findById(receiverId, 'email username');
        if (!user) return null;
        return {
          user: { id: user._id, email: user.email, username: user.username },
          conversationId: conversation._id,
        };
      })
    );

    res.status(200).json(conversationUserData.filter(Boolean));
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

app.post("/api/message", async (req, res) => {
  try {
    const { conversationId, senderId, message, receiverId } = req.body;

    const newMessage = await Message.create({
      conversationId,
      senderId,
      message,
      receiverId,
    });

    res.status(200).json({
      id: newMessage._id,
      conversationId: newMessage.conversationId,
      senderId: newMessage.senderId,
      message: newMessage.message,
      createdAt: newMessage.createdAt,
    });
  } catch (error) {
    console.error("Error handling message request:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.get('/api/message/:conversationId', async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const messages = await Message.find({ conversationId });

    const messageData = await Promise.all(
      messages.map(async (message) => {
        const user = await Users.findById(message.senderId, 'email username');
        return {
          user: { id: user._id, email: user.email, username: user.username },
          message: message.message,
          conversationId,
          createdAt: message.createdAt,
        };
      })
    );

    res.status(200).json(messageData);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Start server after DB connection
conn.then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}).catch(err => {
  console.error('Failed to connect to database:', err);
});
