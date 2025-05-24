import React, { useState, useRef, useEffect } from 'react';
import { User, Room, Message } from '../types';
import { Modal } from '../components/Modal';
import { SendIcon, PlusIcon, UsersIcon } from '../components/icons';
import { Spinner } from '../components/Spinner'; // Import Spinner

interface ChatViewProps {
  currentUser: User;
  rooms: Room[];
  messagesByRoom: { [roomId: string]: Message[] };
  onCreateRoom: (roomName: string, callback: (room: Room | null) => void) => void;
  onSendMessage: (roomId: string, text: string) => void;
  onFetchMessagesForRoom: (roomId: string, callback: (messages: Message[]) => void) => void;
  isAppLoading: boolean; // Global loading state from App.tsx
}

const ChatView: React.FC<ChatViewProps> = ({
  currentUser,
  rooms,
  messagesByRoom,
  onCreateRoom,
  onSendMessage,
  onFetchMessagesForRoom,
  isAppLoading 
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isCreateRoomModalOpen, setCreateRoomModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);

  const selectedRoom = rooms.find(room => room.id === selectedRoomId);
  const currentRoomMessages = selectedRoomId ? messagesByRoom[selectedRoomId] || [] : [];

  useEffect(() => {
    if (rooms.length > 0 && !selectedRoomId && !isAppLoading) {
      handleRoomSelect(rooms[0].id);
    } else if (rooms.length > 0 && selectedRoomId && !rooms.find(r => r.id === selectedRoomId) && !isAppLoading) {
      handleRoomSelect(rooms.length > 0 ? rooms[0].id : null);
    } else if (rooms.length === 0 && selectedRoomId) {
      setSelectedRoomId(null);
    }
  }, [rooms, isAppLoading]);

  useEffect(() => {
    if (currentRoomMessages.length > 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentRoomMessages]);

  const handleRoomSelect = (roomId: string | null) => {
    if (roomId && roomId !== selectedRoomId) {
      setSelectedRoomId(roomId);
      setIsFetchingMessages(true);
      onFetchMessagesForRoom(roomId, (_fetchedMessages) => {
        setIsFetchingMessages(false);
        // Messages are updated in App.tsx state by onFetchMessagesForRoom
        // and passed down.
      });
    } else if (roomId === null) {
      setSelectedRoomId(null);
    }
  };

  const handleCreateRoomSubmit = () => {
    if (newRoomName.trim() && !isAppLoading) {
      onCreateRoom(newRoomName, (createdRoom) => {
        if (createdRoom) {
          handleRoomSelect(createdRoom.id); 
        }
        setNewRoomName('');
        setCreateRoomModalOpen(false);
      });
    }
  };

  const handleSendMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoomId && newMessage.trim() && !isAppLoading && !isFetchingMessages) {
      onSendMessage(selectedRoomId, newMessage);
      setNewMessage('');
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-full sm:w-1/4 bg-gray-800 p-3 sm:p-4 flex flex-col border-r border-gray-700 min-w-[200px] max-w-full sm:max-w-[300px]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-purple-300 flex items-center">
            <UsersIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2" /> Rooms
          </h2>
          <button
            onClick={() => setCreateRoomModalOpen(true)}
            className="p-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Create new room"
            aria-label="Create new room"
            disabled={isAppLoading}
          >
            <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-grow pr-1 custom-scrollbar">
          {isAppLoading && rooms.length === 0 && <Spinner size="w-6 h-6" message="Loading..." className="py-4" />}
          {!isAppLoading && rooms.length === 0 && <p className="text-gray-400 text-sm p-2">No rooms yet. Create one!</p>}
          
          {rooms.map(room => (
            <div
              key={room.id}
              onClick={() => !isAppLoading && !isFetchingMessages && handleRoomSelect(room.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') !isAppLoading && !isFetchingMessages && handleRoomSelect(room.id)}}
              tabIndex={0}
              role="button"
              aria-pressed={selectedRoomId === room.id}
              aria-label={`Select room ${room.name}`}
              className={`p-3 mb-2 rounded-lg cursor-pointer transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75
                ${selectedRoomId === room.id ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'}
                ${(isAppLoading || isFetchingMessages) ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <p className="font-medium truncate text-sm sm:text-base" title={room.name}>{room.name}</p>
              <p className="text-xs opacity-80">
                By: {room.createdBy.name === currentUser.name ? 'You' : room.createdBy.name}
              </p>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col bg-gray-900">
        {selectedRoom ? (
          <>
            <header className="bg-gray-800 p-3 sm:p-4 shadow-md border-b border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-purple-300 truncate" title={selectedRoom.name}>{selectedRoom.name}</h2>
              <p className="text-xs sm:text-sm text-gray-400">
                {isFetchingMessages ? 'Loading messages...' : `${currentRoomMessages.length} message${currentRoomMessages.length === 1 ? '' : 's'}`}
              </p>
            </header>
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 sm:space-y-4 custom-scrollbar">
              {isFetchingMessages && currentRoomMessages.length === 0 && (
                <div className="flex justify-center items-center h-full">
                   <Spinner size="w-8 h-8" message="Fetching messages..." />
                </div>
              )}
              {!isFetchingMessages && currentRoomMessages.length === 0 && (
                 <div className="text-center text-gray-400 mt-8">No messages yet. Be the first to say something!</div>
              )}
              {currentRoomMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex message-appear ${msg.sender.id === currentUser.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-lg xl:max-w-xl p-2.5 sm:p-3 rounded-xl shadow ${
                      msg.sender.id === currentUser.id
                        ? 'bg-purple-600 text-white rounded-br-none'
                        : 'bg-gray-700 text-gray-200 rounded-bl-none'
                    }`}
                  >
                    <p className="font-semibold text-xs sm:text-sm mb-0.5 sm:mb-1">
                      {msg.sender.id === currentUser.id ? 'You' : msg.sender.name}
                    </p>
                    <p className="text-sm sm:text-base break-words whitespace-pre-wrap">{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessageSubmit} className="p-3 sm:p-4 border-t border-gray-700 bg-gray-800 flex items-center gap-2 sm:gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200 disabled:opacity-50"
                disabled={isAppLoading || isFetchingMessages}
                aria-label="Message input"
              />
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-3 sm:py-3 sm:px-5 rounded-lg transition-colors duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!newMessage.trim() || isAppLoading || isFetchingMessages}
                aria-label="Send message"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4 text-center">
             {isAppLoading && rooms.length === 0 ? (
                <Spinner size="w-10 h-10" message="Loading rooms..." />
             ) : (
                <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl border border-gray-700">
                  <UsersIcon className="w-12 h-12 sm:w-16 sm:h-16 text-purple-500 mx-auto mb-4" />
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-200 mb-2">Welcome to ConnectSphere!</h2>
                  <p className="text-gray-400 text-sm sm:text-base">
                    {rooms.length > 0 ? 'Select a room to start chatting or create a new one.' : 'Create a room to start chatting.'}
                  </p>
                  {rooms.length === 0 && !isAppLoading && (
                     <button
                        onClick={() => setCreateRoomModalOpen(true)}
                        className="mt-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center mx-auto disabled:opacity-50"
                        disabled={isAppLoading}
                        aria-label="Create first room"
                      >
                        <PlusIcon className="w-5 h-5 mr-2" /> Create Room
                      </button>
                  )}
                </div>
             )}
          </div>
        )}
      </main>

      <Modal
        isOpen={isCreateRoomModalOpen}
        onClose={() => !isAppLoading && setCreateRoomModalOpen(false)}
        title="Create New Room"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateRoomSubmit();
          }}
          className="space-y-4"
        >
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Room Name"
            className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200 disabled:opacity-60"
            required
            autoFocus
            disabled={isAppLoading}
            aria-label="New room name"
          />
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => !isAppLoading && setCreateRoomModalOpen(false)}
              className="px-4 py-2 text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors duration-200 disabled:opacity-50"
              disabled={isAppLoading}
              aria-label="Cancel create room"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isAppLoading || !newRoomName.trim()}
              aria-label="Confirm create room"
            >
              {isAppLoading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ChatView;