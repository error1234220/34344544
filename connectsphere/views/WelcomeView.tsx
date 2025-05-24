import React, { useState } from 'react';

const USERNAME_STORAGE_KEY = 'connectSphereUsername'; // Ensure consistency

interface WelcomeViewProps {
  onLogin: (username: string) => void;
  isLoading: boolean;
}

const WelcomeView: React.FC<WelcomeViewProps> = ({ onLogin, isLoading }) => {
  const [username, setUsername] = useState(localStorage.getItem(USERNAME_STORAGE_KEY) || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && !isLoading) {
      onLogin(username.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 p-4 sm:p-8 selection:bg-purple-500 selection:text-white">
      <div className="bg-gray-800 p-6 sm:p-10 rounded-xl shadow-2xl w-full max-w-md text-center border border-gray-700">
        <h1 className="text-4xl sm:text-5xl font-bold text-purple-400 mb-3">ConnectSphere</h1>
        <p className="text-gray-300 mb-6 sm:mb-8 text-md sm:text-lg">Enter your username to join the conversation!</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your Username"
            className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all duration-300 ease-in-out shadow-sm hover:border-gray-500 disabled:opacity-60"
            required
            autoFocus
            disabled={isLoading}
            aria-label="Your Username"
          />
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            disabled={isLoading || !username.trim()}
          >
            {isLoading ? 'Connecting...' : 'Enter Chat'}
          </button>
        </form>
      </div>
       <footer className="mt-8 sm:mt-12 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} ConnectSphere. Chat in real-time.</p>
      </footer>
    </div>
  );
};

export default WelcomeView;