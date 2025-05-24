
// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true, // Reflects the request origin. Can be more compatible than "*" in some proxy setups.
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"] // Common headers, though Authorization isn't used here yet.
  },
  transports: ['websocket', 'polling'], // Explicitly define transports
  allowEIO3: true // Enable compatibility with Engine.IO v3 clients/proxies
});

const PORT = process.env.PORT || 3000;

// Serve static files from the root directory (for index.html, index.tsx etc.)
app.use(express.static(path.join(__dirname)));

// In-memory store
let serverUsers = {}; // socket.id -> { id: socket.id, name: string }
let serverRooms = []; // Room[]: { id: string, name: string, createdBy: User (name, id from server) }
let serverMessagesByRoom = {}; // roomId -> Message[]

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send existing rooms to newly connected client (can be useful before login)
  socket.emit('initialRooms', serverRooms);

  socket.on('login', (username, callback) => {
    if (!username || !username.trim()) {
      if (typeof callback === 'function') callback({ error: 'Username is required.' });
      return;
    }
    const user = { id: socket.id, name: username.trim() };
    serverUsers[socket.id] = user;
    console.log('User logged in:', user);
    if (typeof callback === 'function') {
      // Send back user object and current rooms list
      callback({ currentUser: user, rooms: serverRooms });
    }
  });

  socket.on('createRoom', ({ roomName }, callback) => {
    const creatingUser = serverUsers[socket.id];
    if (!creatingUser) {
       if (typeof callback === 'function') callback({ error: 'User not authenticated.' });
       return;
    }
    if (!roomName || !roomName.trim()) {
      if (typeof callback === 'function') callback({ error: 'Room name is required.' });
      return;
    }

    const trimmedRoomName = roomName.trim();
    const existingRoom = serverRooms.find(r => r.name.toLowerCase() === trimmedRoomName.toLowerCase());
    if (existingRoom) {
      if (typeof callback === 'function') callback({ room: existingRoom, isNew: false, error: 'Room already exists. Joining existing room.' });
      socket.join(existingRoom.id); // Ensure user joins if they "created" an existing one
      return;
    }

    const newRoom = {
      id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: trimmedRoomName,
      createdBy: creatingUser
    };
    serverRooms.push(newRoom);
    serverMessagesByRoom[newRoom.id] = [];
    console.log('Room created:', newRoom);
    io.emit('roomCreated', newRoom); // Broadcast to all clients
    socket.join(newRoom.id); 
    if (typeof callback === 'function') callback({ room: newRoom, isNew: true });
  });

  socket.on('joinRoom', (roomId, callback) => {
    const user = serverUsers[socket.id];
    if (!user) {
       if (typeof callback === 'function') callback({ error: 'User not authenticated for joining room.' });
       return;
    }
    const room = serverRooms.find(r => r.id === roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room not found.' });
      return;
    }
    
    // Leave previous rooms the socket was in, except its own default room (socket.id)
    socket.rooms.forEach(roomIn => {
        if(roomIn !== socket.id && roomIn !== roomId) {
          socket.leave(roomIn);
          console.log(`User ${user.name} left room ${roomIn}`);
        }
    });
    socket.join(roomId);

    console.log(`User ${user.name} (id: ${user.id}) joined room ${room.name} (${roomId})`);
    if (typeof callback === 'function') {
        callback({ messages: serverMessagesByRoom[roomId] || [] });
    }
  });

  socket.on('sendMessage', ({ roomId, text }, callback) => {
    const sender = serverUsers[socket.id];
    if (!sender) {
      if (typeof callback === 'function') callback({ error: 'User not authenticated for sending message.' });
      return;
    }
    if (!roomId || !text || !text.trim()) {
      if (typeof callback === 'function') callback({ error: 'Room ID and text are required.' });
      return;
    }
    if (!serverMessagesByRoom[roomId]) {
        console.error(`Attempted to send message to non-existent or uninitialized room: ${roomId} by user ${sender.name}.`);
        if (serverRooms.find(r => r.id === roomId)) { // Room definition exists but no messages array yet
            serverMessagesByRoom[roomId] = [];
        } else {
            if (typeof callback === 'function') callback({ error: 'Room does not exist.' });
            return;
        }
    }

    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      roomId,
      sender, 
      text: text.trim(),
      timestamp: Date.now(),
    };
    serverMessagesByRoom[roomId].push(message);
    io.to(roomId).emit('newMessage', message); // Emit only to clients in the specific room
    console.log(`Message from ${sender.name} to room ${roomId}: ${text}`);
    if (typeof callback === 'function') callback({ success: true, message });
  });
  
  socket.on('getMessagesForRoom', (roomId, callback) => { // This is primarily for initial load for a room.
    const user = serverUsers[socket.id];
     if (!user) {
       if (typeof callback === 'function') callback([]); // Or send error: { error: 'User not authenticated.' }
       return;
    }
    if (typeof callback === 'function') {
      callback(serverMessagesByRoom[roomId] || []);
    }
  });

  socket.on('getAllRooms', (callback) => {
    if (typeof callback === 'function') {
        callback(serverRooms);
    }
  });

  socket.on('disconnect', (reason) => {
    const user = serverUsers[socket.id];
    if (user) {
      console.log(`User disconnected: ${user.name} (id: ${socket.id}), reason: ${reason}`);
      // TODO: Optionally notify other users in rooms this user was in
      // For now, just remove them from the active users list
      delete serverUsers[socket.id];
    } else {
      console.log(`User (unknown) disconnected: ${socket.id}, reason: ${reason}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`ConnectSphere server listening on port ${PORT}`);
});
