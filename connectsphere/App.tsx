
import React, { useState, useEffect, useRef } from 'react';
import { AppView, User, Room, Message, ServerToClientEvents, ClientToServerEvents } from './types';
import WelcomeView from './views/WelcomeView';
import ChatView from './views/ChatView';
import { LogoutIcon } from './components/icons';
import { Spinner } from './components/Spinner';
import { io, Socket } from 'socket.io-client';

const APP_NAME = "ConnectSphere";
const USERNAME_STORAGE_KEY = 'connectSphereUsername';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.Welcome);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messagesByRoom, setMessagesByRoom] = useState<{ [roomId: string]: Message[] }>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start with loading true for initial connection

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  useEffect(() => {
    // Initialize currentUser from localStorage
    const savedUsername = localStorage.getItem(USERNAME_STORAGE_KEY);
    if (savedUsername && !currentUser) {
      // Temporarily set user with name only, full auth on server
      setCurrentUser({ id: '', name: savedUsername });
    }
    setIsLoading(true); // Show loading during initial socket connection attempt

    const newSocket = io(window.location.origin, {
      autoConnect: false,
      reconnectionAttempts: 3,
      timeout: 10000,
      transports: ['websocket', 'polling'], // Prioritize WebSocket
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setError(null);
      
      const localUsername = localStorage.getItem(USERNAME_STORAGE_KEY);
      if (localUsername) {
        // If user was previously "logged in" (i.e. has a username stored)
        // and is not yet fully authenticated with current socket ID.
        if (!currentUser || !currentUser.id || currentUser.id !== newSocket.id) {
          handleLogin(localUsername);
        } else {
          // Already authenticated with this socket session
          setCurrentView(AppView.Chat);
          setIsLoading(false);
          // Optionally refresh rooms if needed
          // newSocket.emit('getAllRooms', (allRooms) => setRooms(allRooms));
        }
      } else {
        setCurrentView(AppView.Welcome);
        setIsLoading(false);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        setError("Disconnected by server. Please login again.");
        handleLogout(false); // Soft logout, don't disconnect socket manually again
      } else if (reason !== 'io client disconnect') {
        setError("Connection lost. Attempting to reconnect...");
        setIsLoading(true); // Show loading as socket.io attempts to reconnect
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message, err); // Log the full error object
      setError(`Connection failed: ${err.message}. Please try refreshing.`);
      setIsLoading(false);
      setCurrentUser(null);
      setCurrentView(AppView.Welcome);
    });

    newSocket.on('initialRooms', (initialRooms) => {
      // This can be useful if server sends rooms upon any connection,
      // before login. If login is the primary source, this might be less critical.
      // Only update if rooms are currently empty and user is not yet in chat view.
      if (rooms.length === 0 && currentView !== AppView.Chat) {
        setRooms(initialRooms);
      }
    });

    newSocket.on('roomCreated', (newRoom) => {
      setRooms(prevRooms => {
        if (prevRooms.find(r => r.id === newRoom.id)) return prevRooms;
        return [...prevRooms, newRoom];
      });
    });

    newSocket.on('newMessage', (newMessage) => {
      setMessagesByRoom(prevMessages => ({
        ...prevMessages,
        [newMessage.roomId]: [...(prevMessages[newMessage.roomId] || []), newMessage],
      }));
    });
    
    newSocket.on('error', (errorMessage) => { // Custom server errors
        console.error('Server application error:', errorMessage);
        setError(errorMessage);
        setIsLoading(false); // Stop loading if a server error occurs during an operation
    });

    newSocket.connect(); // Manually connect the socket

    return () => {
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('connect_error');
      newSocket.off('initialRooms');
      newSocket.off('roomCreated');
      newSocket.off('newMessage');
      newSocket.off('error');
      if (newSocket.connected) {
        newSocket.disconnect();
      }
      socketRef.current = null;
    };
  }, []); // Empty dependency array: runs once on mount

  useEffect(() => {
    if (currentUser && currentUser.id) { // User is fully authenticated by server
      localStorage.setItem(USERNAME_STORAGE_KEY, currentUser.name);
      setCurrentView(AppView.Chat);
      setError(null);
      setIsLoading(false); 
    } else if (!currentUser && currentView !== AppView.Welcome ) {
      // If user is logged out or cleared, ensure localStorage is cleared and view is Welcome
      localStorage.removeItem(USERNAME_STORAGE_KEY);
      setCurrentView(AppView.Welcome);
      setIsLoading(false);
    }
  }, [currentUser, currentView]);


  const emitLogin = (username: string) => {
    if (!socketRef.current) return;
    setIsLoading(true);
    setError(null);
    socketRef.current.emit('login', username.trim(), (response) => {
      setIsLoading(false);
      if (response.error) {
        setError(response.error);
        setCurrentUser(null); // Clear user, triggers useEffect to handle localStorage and view
      } else if (response.currentUser) {
        setCurrentUser(response.currentUser); // Triggers useEffect
        if(response.rooms) setRooms(response.rooms);
      }
    });
  };

  const handleLogin = (username: string) => {
    if (!username.trim()) {
      setError("Username cannot be empty.");
      return;
    }
    if (socketRef.current) {
      if (!socketRef.current.connected) {
        setIsLoading(true);
        setError("Connecting to server...");
        // `once` ensures this handler is for this specific connection attempt for login
        socketRef.current.once('connect', () => {
            console.log('Connected after explicit call in handleLogin, now emitting login for', username);
            emitLogin(username);
        });
        if (!socketRef.current.active) { // If not even trying to connect
            socketRef.current.connect();
        }
      } else {
        emitLogin(username);
      }
    } else {
      setError("Chat service not initialized. Please refresh.");
      setIsLoading(false);
    }
  };

  const handleLogout = (manualDisconnect = true) => {
    if (manualDisconnect && socketRef.current && socketRef.current.connected) {
      socketRef.current.disconnect(); 
    }
    setCurrentUser(null); // This triggers useEffect to clear localStorage and set view
    setRooms([]); // Clear rooms and messages on logout
    setMessagesByRoom({});
    setError(null);
    // After manual logout, if user tries to log in again, main useEffect will reconnect.
    // Or, if we want to immediately allow re-login without page refresh:
    // if (manualDisconnect && socketRef.current && !socketRef.current.connected) {
    //   socketRef.current.connect(); // Re-prepare socket for a new session
    // }
  };

  const handleCreateRoom = (roomName: string, callback: (room: Room | null) => void) => {
    if (!currentUser || !socketRef.current || !socketRef.current.connected) {
      setError("Not connected or not logged in.");
      if (callback) callback(null);
      return;
    }
    setIsLoading(true); // Use global loading for critical actions like room creation
    socketRef.current.emit('createRoom', { roomName }, (response) => {
      setIsLoading(false);
      if (response.error) {
        setError(response.error);
        if (callback) callback(null);
      } else if (response.room) {
        if (callback) callback(response.room);
      }
    });
  };

  const handleSendMessage = (roomId: string, text: string) => {
    if (!currentUser || !text.trim() || !socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('sendMessage', { roomId, text }, (response) => {
      if (response.error) {
        setError(response.error);
      }
      // newMessage event will handle UI update
    });
  };

  const fetchMessagesForRoom = (roomId: string, callback: (messages: Message[]) => void) => {
    if (socketRef.current && socketRef.current.connected) {
      // This loading is handled by ChatView's isFetchingMessages
      socketRef.current.emit('joinRoom', roomId, (response) => {
        if (response.error) {
          setError(response.error);
          callback([]);
        } else if (response.messages) {
          setMessagesByRoom(prev => ({...prev, [roomId]: response.messages!}));
          callback(response.messages);
        }
      });
    } else {
      setError("Not connected to server.");
      callback([]);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden">
      {currentUser && currentUser.id && currentView === AppView.Chat && (
        <header className="bg-gray-800 p-3 sm:p-4 shadow-md flex justify-between items-center border-b border-gray-700">
          <h1 className="text-xl sm:text-2xl font-bold text-purple-400">{APP_NAME}</h1>
          <div className="flex items-center">
            <span className="mr-2 sm:mr-4 text-sm sm:text-base text-gray-300">
              Welcome, <span className="font-medium">{currentUser.name}</span>!
            </span>
            <button
              onClick={() => handleLogout()}
              className="p-2 rounded-md hover:bg-red-700 bg-red-600 text-white hover:text-red-100 transition-colors flex items-center text-sm sm:text-base"
              title="Logout"
              aria-label="Logout"
            >
              <LogoutIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1" /> Logout
            </button>
          </div>
        </header>
      )}
      
      {error && (
        <div className="bg-red-500 text-white p-3 text-center text-sm relative">
          <span>{error}</span>
          <button 
            onClick={() => setError(null)} 
            className="ml-4 text-xs underline hover:text-red-200 absolute right-3 top-1/2 transform -translate-y-1/2"
            aria-label="Dismiss error message"
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading && currentView === AppView.Welcome && (
         <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-50">
            <Spinner message="Connecting..." />
          </div>
      )}
       {isLoading && currentView === AppView.Chat && !currentUser && ( // Loading for login on chat view
         <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-50">
            <Spinner message="Logging in..." />
          </div>
      )}


      <main className="flex-grow overflow-hidden">
        {currentView === AppView.Welcome && <WelcomeView onLogin={handleLogin} isLoading={isLoading && (!currentUser || !currentUser.id)} />}
        {currentView === AppView.Chat && currentUser && currentUser.id && (
          <ChatView
            currentUser={currentUser}
            rooms={rooms}
            messagesByRoom={messagesByRoom}
            onCreateRoom={handleCreateRoom}
            onSendMessage={handleSendMessage}
            onFetchMessagesForRoom={fetchMessagesForRoom}
            isAppLoading={isLoading} 
          />
        )}
      </main>
    </div>
  );
};

export default App;
