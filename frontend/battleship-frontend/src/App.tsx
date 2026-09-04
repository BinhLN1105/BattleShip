/**
 * Main App Component - Battle Ship Game
 */

import React, { useEffect } from 'react';
import { GameProvider, useGame } from './contexts/GameContext';
import { GameState } from './types/game';
import Login from './components/game/Login';
import MatchIntro from './components/game/MatchIntro';
import ShipPlacement from './components/game/ShipPlacement';
import GameInterface from './components/game/GameInterface';
import './App.css';

// Main App Content
const AppContent: React.FC = () => {
  const { state } = useGame();

  // Global Anti-Cheat: Chặn F12, DevTools và View Source trên toàn bộ ứng dụng
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Chặn F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Chặn Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (hoặc Cmd trên Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Chặn Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && ['U', 'u'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, []);

  // Render appropriate screen based on game state
  const renderCurrentScreen = () => {
    switch (state.gameState) {
      case GameState.DISCONNECTED:
      case GameState.CONNECTING:
      case GameState.CONNECTED:
      case GameState.IN_QUEUE:
        return <Login />;
        
      case GameState.GAME_FOUND:
        return <MatchIntro />;
        
      case GameState.PLACING_SHIPS:
        return <ShipPlacement />;
        
      case GameState.PLAYING:
      case GameState.FINISHED:
        return <GameInterface />;
        
      default:
        return <Login />;
    }
  };

  return (
    <div className="app">
      {renderCurrentScreen()}
      
      {/* Global Error Handler */}
      {state.error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{state.error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Main App with Provider
function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
