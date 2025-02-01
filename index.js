const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const cors = require('cors');

const { addUser, removeUser, getUser, getUsersInRoom } = require('./users');
const router = require('./router');  // Assuming this is a separate file handling regular HTTP requests

const app = express();
const server = http.createServer(app);

// Configure CORS for HTTP requests (optional if needed for API)
app.use(cors({
  origin: ['https://chatting-app4u.netlify.app', 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}));

// Configure Socket.io with CORS settings for WebSocket connections
const io = socketio(server, {
  cors: {
    origin: ['https://chatting-app4u.netlify.app', 'http://localhost:5173'],
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"], // Optional: Use headers if needed
    credentials: true
  }
});

// Middleware for routing HTTP requests
app.use(router);

// Socket.IO logic
io.on('connect', (socket) => {
  
  socket.on('join', ({ name, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, name, room });

    if (error) {
      return callback(error);  // Error handling if user can't be added
    }

    socket.join(user.room);  // User joins the room

    // Welcome the new user and notify others
    socket.emit('message', { user: 'admin', text: `${user.name}, welcome to room ${user.room}.` });
    socket.broadcast.to(user.room).emit('message', { user: 'admin', text: `${user.name} has joined!` });

    // Emit room data (list of users in the room)
    io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });

    callback();  // Callback to confirm success
  });

  // Listen for message and broadcast to room
  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);

    if (user) {
      io.to(user.room).emit('message', { user: user.name, text: message });
    } else {
      console.error('User not found');
    }

    callback();  // Callback to confirm message sent
  });

  // Handle user disconnects
  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit('message', { user: 'Admin', text: `${user.name} has left.` });
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });
    }
  });
});

// Listen on a port (default to 5000 or from environment variable)
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
