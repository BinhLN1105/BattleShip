/**
 * GameInterface Component - Giao diện chính của game khi đang chơi
 */

import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { GameState, CellState, SHIP_CONFIGS, FLEET_CONFIGS, SunkEventData, SHIP_IMAGES } from '../../types/game';
import GameBoard from './GameBoard';
import Chat from './Chat';

export const GameInterface: React.FC = () => {
  const { state, actions } = useGame();
  const [showChat, setShowChat] = useState(true);
  const [showGameOverModal, setShowGameOverModal] = useState(true);
  const myFleetConfig = FLEET_CONFIGS[state.myFleet] || FLEET_CONFIGS.modern;
  const oppFleetConfig = FLEET_CONFIGS[state.opponentFleet] || FLEET_CONFIGS.modern;

  useEffect(() => {
    setShowChat(true); // Tự động mở chat khi vào màn hình chơi
  }, []);

  const [sunkAlert, setSunkAlert] = useState<SunkEventData | null>(null);

  // Tự động bật Modal thông báo Thắng/Thua khi ván đấu kết thúc
  useEffect(() => {
    if (state.gameState === GameState.FINISHED) {
      setShowGameOverModal(true);
    }
  }, [state.gameState]);

  // Lắng nghe sự kiện tàu bị bắn hạ (cả tàu địch và tàu ta) để phát thông báo điện ảnh
  useEffect(() => {
    if (state.latestSunkEvent) {
      setSunkAlert(state.latestSunkEvent);
      const timer = setTimeout(() => {
        setSunkAlert(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [state.latestSunkEvent]);

  // Về trang chủ
  const handleHome = () => {
    actions.resetGame();
  };

  // Anti-Cheat: Chặn phím tắt mở DevTools và View Source trong trận đấu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+U (View Source)
      if (e.ctrlKey && ['U', 'u'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Handle surrender
  const handleSurrender = () => {
    if (window.confirm('Bạn có chắc chắn muốn đầu hàng không?')) {
      actions.surrender();
    }
  };

  // Handle new game
  const handleNewGame = async () => {
    setShowGameOverModal(false);
    await actions.resetGame();
    // Reset lại các state UI của Login (nếu có window object)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('autoStartLogin'));
    }
    if (state.playerName && state.playerName.trim().length > 0) {
      await actions.connect();
      actions.joinQueue();
    }
  };

  // Get turn indicator
  const getTurnIndicator = () => {
    if (state.gameState === GameState.FINISHED) {
      const isWinner = state.winner === state.clientId;
      return (
        <div className={`text-center py-1.5 px-3 rounded-lg font-bold text-xs sm:text-sm shadow flex items-center justify-center gap-2 ${
          isWinner ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <span>{isWinner ? '🎉 CHIẾN THẮNG!' : '😔 THẤT TRẬN!'}</span>
          <button
            onClick={() => setShowGameOverModal(true)}
            className="text-[11px] underline text-yellow-200 hover:text-white ml-1 font-normal"
          >
            (Xem chi tiết)
          </button>
        </div>
      );
    }

    // Hiển thị thời gian còn lại cho lượt hiện tại
    return (
      <div className={`text-center py-1.5 px-3 rounded-lg font-semibold flex items-center justify-between sm:justify-center gap-2 shadow ${
        state.isMyTurn 
          ? 'bg-emerald-600 text-white animate-pulse' 
          : 'bg-slate-700/90 text-slate-200'
      }`}>
        <span className="text-xs sm:text-sm">
          {state.isMyTurn ? '🎯 LƯỢT CỦA BẠN - HÃY BẮN!' : '⏳ Đang chờ đối thủ...'}
        </span>
        <span className="text-[11px] font-mono bg-black/40 px-2 py-0.5 rounded border border-white/20 whitespace-nowrap">
          Còn <b className="text-yellow-300">{state.turnTimeLeft}s</b>
        </span>
      </div>
    );
  };

  // Get game stats
  const getGameStats = () => {
    const myHits = state.opponentBoard.flat().filter(cell => cell === CellState.HIT).length;
    const myMisses = state.opponentBoard.flat().filter(cell => cell === CellState.MISS).length;
    const opponentHits = state.myBoard.flat().filter(cell => cell === CellState.HIT).length;
    const opponentMisses = state.myBoard.flat().filter(cell => cell === CellState.MISS).length;

    return { myHits, myMisses, opponentHits, opponentMisses };
  };

  const { myHits, myMisses, opponentHits, opponentMisses } = getGameStats();

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center relative p-2 sm:p-4 select-none"
      style={{ backgroundImage: "url('/images/ocean-background.jpg')" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Background overlay (z-0) */}
      <div className="fixed inset-0 bg-blue-950/70 pointer-events-none z-0"></div>

      {/* Header Info (z-10) - Compact HUD Style */}
      <div className="relative z-10 max-w-7xl mx-auto mb-3">
        <div className="bg-blue-900/90 backdrop-blur-md rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-xl border border-blue-700/60">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            
            {/* Commander 1 (Player) */}
            <div className="flex items-center gap-2 sm:gap-3 justify-start min-w-0">
              <div className="relative flex-shrink-0" style={{ width: '48px', height: '48px' }}>
                <img
                  src={myFleetConfig.commanderAvatar}
                  alt={myFleetConfig.commanderName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shadow-md bg-slate-900"
                  style={{ width: '48px', height: '48px' }}
                  draggable={false}
                />
                <span className="absolute bottom-0 right-0 bg-emerald-500 w-3 h-3 rounded-full border-2 border-blue-900"></span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-xs sm:text-sm truncate">{state.playerName}</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1 py-0.2 rounded border border-emerald-500/30">BẠN</span>
                </div>
                <div className="text-yellow-300 text-[11px] font-semibold leading-tight truncate">{myFleetConfig.commanderName}</div>
                <div className="text-blue-300 text-[10px] leading-tight hidden md:block truncate">{myFleetConfig.name}</div>
              </div>
            </div>

            {/* Turn Indicator & Room Info */}
            <div className="flex flex-col items-center gap-1 flex-1 max-w-xs sm:max-w-md mx-1 sm:mx-2">
              <div className="w-full">
                {getTurnIndicator()}
              </div>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs text-blue-200">
                <span className="bg-blue-950/70 px-2 py-0.5 rounded border border-blue-700/60 font-mono">
                  Phòng: <b className="text-yellow-300">{state.roomId ? state.roomId.slice(0, 8) : '...'}</b>
                </span>
                <span className="text-blue-300/80 hidden sm:inline">•</span>
                <span className="text-blue-300/80 hidden sm:inline">Hải chiến 5 vs 5</span>
              </div>
            </div>

            {/* Commander 2 (Opponent) & Actions */}
            <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-0">
              <div className="text-right min-w-0">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[9px] bg-red-500/20 text-red-300 font-bold px-1 py-0.2 rounded border border-red-500/30">ĐỐI THỦ</span>
                  <span className="font-bold text-white text-xs sm:text-sm truncate">{state.opponentName || 'Đối thủ'}</span>
                </div>
                <div className="text-yellow-300 text-[11px] font-semibold leading-tight truncate">{oppFleetConfig.commanderName}</div>
                <div className="text-blue-300 text-[10px] leading-tight hidden md:block truncate">{oppFleetConfig.name}</div>
              </div>
              <div className="relative flex-shrink-0" style={{ width: '48px', height: '48px' }}>
                <img
                  src={oppFleetConfig.commanderAvatar}
                  alt={oppFleetConfig.commanderName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-red-400 shadow-md bg-slate-900"
                  style={{ width: '48px', height: '48px' }}
                  draggable={false}
                />
                <span className="absolute bottom-0 right-0 bg-red-500 w-3 h-3 rounded-full border-2 border-blue-900"></span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 ml-1">
                {state.gameState === GameState.PLAYING && (
                  <button
                    onClick={handleSurrender}
                    className="bg-red-600/90 hover:bg-red-700 text-white font-semibold px-2.5 py-1.5 rounded-lg transition-colors shadow text-[11px] sm:text-xs flex items-center gap-1 whitespace-nowrap"
                  >
                    🏳️ <span className="hidden sm:inline">Đầu hàng</span>
                  </button>
                )}
                
                {state.gameState === GameState.FINISHED && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleNewGame}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2.5 py-1.5 rounded-lg transition-colors shadow-lg text-[11px] sm:text-xs flex items-center gap-1 whitespace-nowrap"
                    >
                      🎮 <span className="hidden sm:inline">Ván mới</span>
                    </button>
                    <button
                      onClick={handleHome}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2.5 py-1.5 rounded-lg transition-colors shadow-lg text-[11px] sm:text-xs flex items-center gap-1 whitespace-nowrap"
                    >
                      🏠 <span className="hidden sm:inline">Trang chủ</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Sunk Ship Alert Banner - Xuất hiện đồng thời trên màn hình cả 2 người chơi khi có tàu bị bắn hạ */}
      {sunkAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 pointer-events-none animate-in slide-in-from-top-6 zoom-in-95 duration-500">
          <div className={`p-4 rounded-2xl border-2 shadow-2xl backdrop-blur-md flex items-center gap-4 ${
            sunkAlert.isEnemy
              ? 'bg-gradient-to-r from-amber-950/95 via-red-950/90 to-amber-950/95 border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.6)]'
              : 'bg-gradient-to-r from-rose-950/95 via-slate-950/90 to-rose-950/95 border-rose-500 shadow-[0_0_35px_rgba(244,63,94,0.7)] animate-pulse'
          }`}>
            {/* Thumbnail chiến hạm đang chìm */}
            <div className={`w-20 h-14 rounded-xl p-1 flex items-center justify-center relative overflow-hidden border flex-shrink-0 ${
              sunkAlert.isEnemy ? 'bg-amber-900/40 border-amber-500/50' : 'bg-rose-900/40 border-rose-500/50'
            }`}>
              <img
                src={FLEET_CONFIGS[sunkAlert.fleet]?.ships[sunkAlert.type] || SHIP_IMAGES[sunkAlert.type]}
                alt={sunkAlert.type}
                className={`w-full h-full object-contain filter drop-shadow ${
                  sunkAlert.isEnemy ? 'enemy-ship-sink' : 'friendly-ship-sink'
                }`}
                draggable={false}
              />
              <div className="absolute inset-x-0 bottom-0 bg-blue-900/70 h-2/5 pointer-events-none" />
            </div>

            {/* Chi tiết sự kiện chìm tàu */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                  sunkAlert.isEnemy ? 'bg-amber-400 text-amber-950' : 'bg-rose-500 text-white'
                }`}>
                  {sunkAlert.isEnemy ? '🎯 BẮN HẠ TÀU ĐỊCH' : '⚠️ TÀU TA BỊ HẠ'}
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  ({SHIP_CONFIGS[sunkAlert.type].size} ô)
                </span>
              </div>
              <h4 className={`text-base font-black mt-0.5 truncate ${
                sunkAlert.isEnemy ? 'text-yellow-300' : 'text-rose-300'
              }`}>
                {sunkAlert.isEnemy
                  ? `Đã bắn chìm ${SHIP_CONFIGS[sunkAlert.type].name} của đối thủ!`
                  : `Tàu ${SHIP_CONFIGS[sunkAlert.type].name} của bạn đã bị bắn chìm!`
                }
              </h4>
              <p className="text-[11px] text-slate-300 truncate">
                {sunkAlert.isEnemy
                  ? `Hạm đội ${FLEET_CONFIGS[sunkAlert.fleet]?.name || ''} của đối thủ chịu tổn thất nặng nề.`
                  : `Tàu đang chìm dần xuống đáy biển. Hãy tập trung hỏa lực phản kích!`
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Game Area (z-10) */}
      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* My Board */}
          <div className="xl:col-span-1">
            <div className="bg-slate-900/40 rounded-xl p-3 backdrop-blur-sm border border-blue-500/20 flex justify-center">
              <GameBoard
                board={state.myBoard}
                isOpponentBoard={false}
                placedShips={state.placedShips}
                sunkShips={state.mySunkShips}
                className="w-full text-center"
              />
            </div>
            
            {/* My Stats */}
            <div className="mt-4 bg-blue-900/80 rounded-xl p-4 shadow-lg border border-blue-700/50">
              <h3 className="text-white font-bold text-sm mb-3 flex items-center justify-between">
                <span>{myFleetConfig.name} ({state.playerName})</span>
                <span className="text-xs text-yellow-300 font-normal">Đã mất: {state.mySunkShips.length} tàu</span>
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-blue-950/60 p-2.5 rounded-lg border border-blue-800">
                  <div className="text-blue-300 text-xs">Tàu còn nổi:</div>
                  <div className="text-emerald-400 text-lg font-bold">
                    {Math.max(0, 5 - state.mySunkShips.length)} / 5
                  </div>
                </div>
                <div className="bg-blue-950/60 p-2.5 rounded-lg border border-blue-800">
                  <div className="text-blue-300 text-xs">Phát bắn trúng:</div>
                  <div className="text-red-400 text-lg font-bold">{opponentHits}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Opponent Board */}
          <div className="xl:col-span-1">
            <div className="bg-slate-900/40 rounded-xl p-3 backdrop-blur-sm border border-blue-500/20 flex justify-center">
              <GameBoard
                board={state.opponentBoard}
                isOpponentBoard={true}
                sunkShips={state.opponentSunkShips}
                canShoot={state.gameState === GameState.PLAYING}
                className="w-full text-center"
              />
            </div>
            
            {/* Opponent Stats */}
            <div className="mt-4 bg-blue-900/80 rounded-xl p-4 shadow-lg border border-blue-700/50">
              <h3 className="text-white font-bold text-sm mb-3 flex items-center justify-between">
                <span>{oppFleetConfig.name} ({state.opponentName || 'Đối thủ'})</span>
                <span className="text-xs text-emerald-300 font-normal">Đã hạ: {state.opponentSunkShips.length} tàu</span>
              </h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-blue-950/60 p-2 rounded-lg border border-blue-800 text-center">
                  <div className="text-blue-300 text-xs">Đã hạ:</div>
                  <div className="text-yellow-400 text-lg font-bold">
                    {state.opponentSunkShips.length} / 5
                  </div>
                </div>
                <div className="bg-blue-950/60 p-2 rounded-lg border border-blue-800 text-center">
                  <div className="text-blue-300 text-xs">Bắn trúng:</div>
                  <div className="text-emerald-400 text-lg font-bold">{myHits}</div>
                </div>
                <div className="bg-blue-950/60 p-2 rounded-lg border border-blue-800 text-center">
                  <div className="text-blue-300 text-xs">Độ chính xác:</div>
                  <div className="text-cyan-300 text-lg font-bold">
                    {myHits + myMisses > 0 
                      ? Math.round((myHits / (myHits + myMisses)) * 100) 
                      : 0}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel (Chat & Guide) */}
          <div className="xl:col-span-1 space-y-4">
            {/* Chat */}
            {showChat && (
              <Chat className="w-full" />
            )}
            
            {/* Legend & Guide */}
            <div className="bg-blue-900/80 rounded-xl p-4 shadow-lg border border-blue-700/50">
              <h3 className="text-white font-bold text-sm mb-3">Tín hiệu chiến thuật</h3>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-blue-100 border border-blue-300 rounded-sm"></div>
                  <span className="text-blue-200">Vùng biển chưa bắn</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-red-600 border border-red-800 rounded-sm flex items-center justify-center text-[10px] text-white font-bold">×</div>
                  <span className="text-red-300">Bắn trúng (Hit)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-blue-400 border border-blue-600 rounded-sm"></div>
                  <span className="text-blue-300">Bắn trượt (Miss)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-red-950 border border-red-500 rounded-sm flex items-center justify-center text-[8px] text-red-300 font-bold">HẠ</div>
                  <span className="text-orange-300">Tàu đã chìm</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Victory / Defeat Modal Popup */}
      {state.gameState === GameState.FINISHED && showGameOverModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`relative max-w-md w-full bg-slate-900/95 rounded-2xl p-6 border-2 shadow-2xl text-center transform animate-in zoom-in-95 duration-300 ${
            state.winner === state.clientId
              ? 'border-yellow-400 shadow-[0_0_50px_rgba(234,179,8,0.4)]'
              : 'border-red-600 shadow-[0_0_50px_rgba(239,68,68,0.4)]'
          }`}>
            {/* Close modal button to review board */}
            <button
              onClick={() => setShowGameOverModal(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Đóng để xem lại bàn cờ"
            >
              ✕
            </button>

            {/* Banner & Title */}
            {state.winner === state.clientId ? (
              <>
                {/* Cúp chiến thắng với hiệu ứng pháo hoa rực rỡ tỏa tròn */}
                <div className="relative inline-flex items-center justify-center my-3">
                  {/* Vòng nổ pháo hoa lan tỏa */}
                  <div className="absolute w-20 h-20 rounded-full border-2 border-yellow-300 firework-ring-1 pointer-events-none" />
                  <div className="absolute w-24 h-24 rounded-full border-2 border-emerald-400 firework-ring-2 pointer-events-none" />
                  <div className="absolute w-28 h-28 rounded-full border-2 border-rose-400 firework-ring-3 pointer-events-none" />

                  {/* Các tia pháo hoa & ngôi sao bay tỏa ra 8 hướng xung quanh cúp */}
                  <span className="absolute text-yellow-300 text-base firework-spark pointer-events-none" style={{ '--tx': '50px', '--ty': '-40px' } as any}>✨</span>
                  <span className="absolute text-amber-400 text-lg firework-spark pointer-events-none" style={{ '--tx': '-50px', '--ty': '-35px', animationDelay: '0.25s' } as any}>💥</span>
                  <span className="absolute text-emerald-300 text-base firework-spark pointer-events-none" style={{ '--tx': '55px', '--ty': '25px', animationDelay: '0.5s' } as any}>⭐</span>
                  <span className="absolute text-cyan-300 text-lg firework-spark pointer-events-none" style={{ '--tx': '-50px', '--ty': '30px', animationDelay: '0.75s' } as any}>🌟</span>
                  <span className="absolute text-purple-300 text-base firework-spark pointer-events-none" style={{ '--tx': '0px', '--ty': '-55px', animationDelay: '0.35s' } as any}>✨</span>
                  <span className="absolute text-rose-400 text-lg firework-spark pointer-events-none" style={{ '--tx': '0px', '--ty': '50px', animationDelay: '0.6s' } as any}>💥</span>
                  <span className="absolute text-yellow-200 text-base firework-spark pointer-events-none" style={{ '--tx': '35px', '--ty': '-30px', animationDelay: '0.85s' } as any}>⭐</span>
                  <span className="absolute text-blue-300 text-base firework-spark pointer-events-none" style={{ '--tx': '-35px', '--ty': '-30px', animationDelay: '0.95s' } as any}>🌟</span>

                  {/* Pháo hoa giấy confetti rơi xung quanh cúp */}
                  <div className="absolute -top-3 -left-4 w-2 h-2 bg-yellow-400 rounded-sm confetti-fall-1 pointer-events-none" />
                  <div className="absolute -top-4 right-2 w-2.5 h-1.5 bg-emerald-400 rounded-full confetti-fall-2 pointer-events-none" />
                  <div className="absolute top-2 -right-5 w-2 h-2 bg-rose-500 rounded-sm confetti-fall-3 pointer-events-none" />
                  <div className="absolute top-1 -left-5 w-1.5 h-2 bg-cyan-400 rounded-full confetti-fall-1 pointer-events-none" />

                  {/* Biểu tượng cúp phát sáng hào quang chiến thắng */}
                  <div className="text-6xl select-none trophy-glow relative z-10 filter drop-shadow-[0_0_30px_rgba(234,179,8,0.9)] animate-bounce">
                    🏆
                  </div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-500 uppercase tracking-wide">
                  CHIẾN THẮNG VANG DỘI!
                </h2>
                <p className="text-emerald-300 text-sm font-medium mt-1">
                  Chúc mừng Đô đốc {state.playerName}! Bạn đã làm chủ hoàn toàn hải phận.
                </p>
                <div className="inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-300 font-bold px-3 py-1 rounded-full border border-yellow-500/40 text-xs mt-2">
                  <span>⭐ Điểm Xếp Hạng:</span>
                  <b className="text-emerald-400">+25 ELO</b>
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl mb-2 animate-pulse">☠️</div>
                <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-300 to-red-600 uppercase tracking-wide">
                  HẠM ĐỘI THẤT TRẬN!
                </h2>
                <p className="text-red-300 text-sm font-medium mt-1">
                  Hạm đội của bạn đã bị đối thủ {state.opponentName || 'Đối thủ'} bắn hạ hoàn toàn.
                </p>
                <div className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-300 font-bold px-3 py-1 rounded-full border border-red-500/40 text-xs mt-2">
                  <span>📉 Điểm Xếp Hạng:</span>
                  <b className="text-red-400">-20 ELO</b>
                </div>
              </>
            )}

            {/* Commander profile card */}
            <div className="my-5 p-3.5 bg-blue-950/60 rounded-xl border border-blue-800/60 flex items-center gap-3.5 text-left">
              <img
                src={myFleetConfig.commanderAvatar}
                alt={myFleetConfig.commanderName}
                className="w-14 h-14 rounded-full object-cover border-2 border-yellow-400/80 shadow-md bg-slate-950 flex-shrink-0"
                style={{ width: '56px', height: '56px' }}
                draggable={false}
              />
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm truncate">{state.playerName}</div>
                <div className="text-yellow-300 text-xs font-medium truncate">{myFleetConfig.commanderName}</div>
                <div className="text-blue-300 text-[11px] truncate">{myFleetConfig.name}</div>
              </div>
            </div>

            {/* Match Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <div className="text-[11px] text-blue-300">Đã bắn trúng</div>
                <div className="text-lg font-black text-emerald-400">{myHits}</div>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <div className="text-[11px] text-blue-300">Độ chính xác</div>
                <div className="text-lg font-black text-cyan-300">
                  {myHits + myMisses > 0 ? Math.round((myHits / (myHits + myMisses)) * 100) : 0}%
                </div>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <div className="text-[11px] text-blue-300">Tàu bảo toàn</div>
                <div className="text-lg font-black text-yellow-300">
                  {Math.max(0, 5 - state.mySunkShips.length)}/5
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleNewGame}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02]"
                >
                  🎮 CHƠI VÁN MỚI
                </button>
                <button
                  onClick={() => setShowGameOverModal(false)}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-600 transition-colors text-sm flex items-center justify-center gap-1.5"
                >
                  🔍 Xem lại bàn cờ
                </button>
              </div>
              <button
                onClick={handleHome}
                className="w-full py-2.5 px-4 bg-blue-900/60 hover:bg-blue-800/80 text-blue-200 hover:text-white font-semibold rounded-xl border border-blue-700/60 transition-colors text-sm flex items-center justify-center gap-2 shadow"
              >
                🏠 Về trang chủ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameInterface;
