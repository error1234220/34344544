export interface User {
  id: string; // Will be socket.id from server
  name: string;
}

export interface Message {
  id: string;
  roomId: string;
  sender: User; // User object { id, name }
  text: string;
  timestamp: number;
}

export interface Room {
  id: string;
  name: string;
  createdBy: User; // User object { id, name }
}

export enum AppView {
  Welcome = 'welcome',
  Chat = 'chat',
}

// For Socket.IO event callbacks
export interface ServerToClientEvents {
  initialRooms: (rooms: Room[]) => void;
  roomCreated: (room: Room) => void;
  newMessage: (message: Message) => void;
  error: (errorMessage: string) => void; // Custom server error messages
}

export interface ClientToServerEvents {
  login: (username: string, callback: (response: { currentUser?: User, rooms?: Room[], error?: string }) => void) => void;
  createRoom: (data: { roomName: string }, callback: (response: { room?: Room, isNew?: boolean, error?: string }) => void) => void;
  joinRoom: (roomId: string, callback: (response: { messages?: Message[], error?: string }) => void) => void;
  sendMessage: (data: { roomId: string, text: string }, callback: (response: { success?: boolean, message?: Message, error?: string }) => void) => void;
  getMessagesForRoom: (roomId: string, callback: (messages: Message[]) => void) => void;
  getAllRooms: (callback: (rooms: Room[]) => void) => void; // For explicitly fetching all rooms
}