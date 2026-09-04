/**
 * Login Component - Giao diện sảnh chờ & Chọn Hạm Đội / Chỉ Huy
 */

import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { GameState, FleetType, FLEET_CONFIGS, ShipType } from '../../types/game';

const FLEET_LIST: FleetType[] = ['modern', 'vintage', 'scifi'];

export const Login: React.FC = () => {
  const { state, actions, dispatch } = useGame();
  const [playerName, setPlayerName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnecting, setShowConnecting] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [queueDuration, setQueueDuration] = useState(0);

  // Bộ đếm thời gian tìm trận (MM:SS)
  useEffect(() => {
    let timer: any = null;
    const isSearching = (showQueue || state.connectionState === GameState.IN_QUEUE) && !state.opponentName;
    if (isSearching) {
      setQueueDuration(0);
      timer = setInterval(() => {
        setQueueDuration(prev => prev + 1);
      }, 1000);
    } else {
      setQueueDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showQueue, state.connectionState, state.opponentName]);

  const formatDuration = (sec: number): string => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Khi nhập tên, hiện text đang kết nối
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 50);
    setPlayerName(value);
    if (value.trim().length >= 2) {
      setShowConnecting(true);
    } else {
      setShowConnecting(false);
    }
  };

  // Chọn hạm đội
  const handleSelectFleet = (fleet: FleetType) => {
    if (isConnecting || showQueue || state.connectionState === GameState.IN_QUEUE) return;
    actions.setSelectedFleet(fleet);
  };

  // Khi ấn bắt đầu chơi
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setIsConnecting(true);
    setShowConnecting(true);
    try {
      dispatch({ type: 'SET_PLAYER_NAME', payload: playerName.trim() });
      await actions.connect();
      setShowQueue(true);
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Khi ấn Hủy tìm đối thủ
  const handleCancelQueue = () => {
    actions.leaveQueue();
    setShowQueue(false);
    setShowConnecting(false);
    setPlayerName('');
  };

  // Luôn đồng bộ input với state.playerName
  useEffect(() => {
    setPlayerName(state.playerName || '');
  }, [state.playerName]);

  // Tự động connect và joinQueue nếu đã có playerName
  useEffect(() => {
    if (
      state.playerName &&
      state.playerName.trim().length > 0 &&
      state.connectionState === GameState.DISCONNECTED
    ) {
      setShowQueue(true);
      setShowConnecting(true);
      (async () => {
        dispatch({ type: 'SET_PLAYER_NAME', payload: state.playerName });
        await actions.connect();
      })();
    }
  }, [state.playerName, state.connectionState, dispatch, actions]);

  // Tự động joinQueue khi đã kết nối thành công
  useEffect(() => {
    if ((showQueue || isConnecting) && state.connectionState === GameState.CONNECTED) {
      actions.joinQueue();
    }
  }, [state.connectionState, showQueue, isConnecting, actions]);

  // Lắng nghe sự kiện autoStartLogin để tự động chuyển trạng thái UI
  useEffect(() => {
    const handler = () => {
      setIsConnecting(true);
      setShowConnecting(true);
      setShowQueue(true);
    };
    window.addEventListener('autoStartLogin', handler);
    return () => window.removeEventListener('autoStartLogin', handler);
  }, []);

  // Xác định text trạng thái
  let statusText = '';
  if (showQueue || state.connectionState === GameState.IN_QUEUE) {
    if (state.opponentName) {
      statusText = 'Đã ghép trận! Đang vào phòng chuẩn bị...';
    } else {
      statusText = `Đang quét tìm đối thủ... (Hàng chờ: ${state.queuePosition || 1})`;
    }
  } else if (showConnecting || state.connectionState === GameState.CONNECTING) {
    statusText = 'Đang kết nối trung tâm chỉ huy...';
  }

  useEffect(() => {
    // Khi vào màn hình Login, xóa clientId cũ để mỗi tab là 1 client mới
    if (typeof window !== 'undefined') {
      localStorage.removeItem('battleship_client_id');
    }
  }, []);

  const currentSelectedFleet = state.selectedFleet || 'modern';
  const activeFleetConfig = FLEET_CONFIGS[currentSelectedFleet];

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 relative overflow-y-auto select-none">
      {/* Ocean background */}
      <div className="fixed inset-0 z-0">
        <img src="/images/ocean-bg.png" alt="ocean background" className="w-full h-full object-cover" />
      </div>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-slate-950/75 z-10"></div>
      
      {/* Glowing backdrop elements */}
      <div className="fixed inset-0 overflow-hidden z-20 pointer-events-none">
        <div className="absolute -top-20 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-20 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Main Container */}
      <div className="relative z-30 w-full max-w-6xl my-auto py-6">
        
        {/* Game Title Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="relative mb-3 group">
            <div className="absolute inset-0 rounded-full bg-yellow-400/20 blur-xl group-hover:blur-2xl transition-all pointer-events-none"></div>
            <img
              src="/logo.png"
              alt="Battleship Combat Logo"
              className="relative w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_4px_16px_rgba(234,179,8,0.4)] transition-transform hover:scale-105 duration-300"
            />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-500/30 text-blue-300 text-xs font-semibold uppercase tracking-widest mb-2 shadow">
            <span>⚓</span> Chiến Lược Trực Tuyến Đa Người Chơi
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-yellow-200 to-amber-400 tracking-wider drop-shadow-md">
            BATTLESHIP COMBAT
          </h1>
          <p className="text-blue-200 text-xs sm:text-sm font-medium mt-1">
            Chọn Bộ Chỉ Huy & Hạm Đội Chiến Thuật Của Bạn Để Xuất Trận
          </p>
        </div>

        {/* Section 1: 3 Commander & Fleet Cards */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-bold text-yellow-300 uppercase tracking-wider flex items-center gap-2">
              <span>🛡️</span> 1. Chọn Hạm Đội & Chỉ Huy
            </h2>
            <span className="text-xs text-blue-300 italic">
              (Mặc định: Hạm Đội Hiện Đại)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FLEET_LIST.map((fleetKey) => {
              const cfg = FLEET_CONFIGS[fleetKey];
              const isSelected = currentSelectedFleet === fleetKey;

              // Border and accent styling based on fleet type
              let cardBorderClass = 'border-slate-700/60 bg-slate-900/80 hover:border-slate-500';
              let badgeBg = 'bg-blue-600/30 text-blue-300 border-blue-500/30';
              let highlightGlow = '';

              if (fleetKey === 'modern') {
                if (isSelected) {
                  cardBorderClass = 'border-cyan-400 ring-2 ring-cyan-400/50 bg-gradient-to-b from-blue-950/90 to-slate-900/90 shadow-[0_0_25px_rgba(6,182,212,0.35)]';
                  badgeBg = 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold';
                  highlightGlow = 'from-cyan-500/20';
                }
              } else if (fleetKey === 'vintage') {
                if (isSelected) {
                  cardBorderClass = 'border-amber-400 ring-2 ring-amber-400/50 bg-gradient-to-b from-amber-950/70 to-slate-900/90 shadow-[0_0_25px_rgba(245,158,11,0.35)]';
                  badgeBg = 'bg-amber-400 text-slate-950 border-amber-300 font-bold';
                  highlightGlow = 'from-amber-500/20';
                }
              } else if (fleetKey === 'scifi') {
                if (isSelected) {
                  cardBorderClass = 'border-purple-400 ring-2 ring-purple-400/50 bg-gradient-to-b from-purple-950/70 to-slate-900/90 shadow-[0_0_25px_rgba(168,85,247,0.35)]';
                  badgeBg = 'bg-purple-400 text-slate-950 border-purple-300 font-bold';
                  highlightGlow = 'from-purple-500/20';
                }
              }

              return (
                <div
                  key={fleetKey}
                  onClick={() => handleSelectFleet(fleetKey)}
                  className={`relative rounded-2xl p-4 cursor-pointer transition-all duration-300 border ${cardBorderClass} flex flex-col justify-between overflow-hidden group`}
                >
                  {/* Active selection glow gradient header */}
                  {isSelected && (
                    <div className={`absolute -top-10 left-0 right-0 h-24 bg-gradient-to-b ${highlightGlow} to-transparent pointer-events-none`} />
                  )}

                  {/* Header: Commander Avatar & Name */}
                  <div className="relative z-10 flex items-start gap-3.5 mb-3">
                    <div className="relative flex-shrink-0">
                      <img
                        src={cfg.commanderAvatar}
                        alt={cfg.commanderName}
                        className={`w-14 h-14 rounded-full object-cover border-2 shadow-lg bg-slate-950 transition-transform duration-300 ${
                          isSelected ? 'border-yellow-400 scale-105' : 'border-slate-600'
                        }`}
                        draggable={false}
                      />
                      {isSelected && (
                        <span className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-yellow-400 tracking-wide uppercase truncate">
                          {cfg.commanderName}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeBg}`}>
                          {isSelected ? '✓ ĐÃ CHỌN' : 'CHỌN'}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-white truncate mt-0.5">
                        {cfg.name}
                      </h3>
                      <p className="text-[11px] text-blue-200/80 truncate">
                        {cfg.commanderTitle}
                      </p>
                    </div>
                  </div>

                  {/* Commander Quote */}
                  <div className="relative z-10 mb-3 bg-black/40 rounded-lg p-2 border border-white/5">
                    <p className="text-[11px] italic text-blue-200/90 leading-tight">
                      "{cfg.quote}"
                    </p>
                  </div>

                  {/* Ship Showcase (4 ships) */}
                  <div className="relative z-10 mt-auto pt-2 border-t border-white/10">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Thiết bị chiến hạm (4 lớp tàu)</span>
                      <span className="text-yellow-400/80">Kích thước 2 - 5 ô</span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 bg-black/30 p-2 rounded-xl border border-white/5">
                      {/* Destroyer */}
                      <div className="flex flex-col items-center group/ship" title="Destroyer (2 ô)">
                        <div className="h-9 w-full flex items-center justify-center p-0.5">
                          <img
                            src={cfg.ships[ShipType.DESTROYER]}
                            alt="Destroyer"
                            className="max-h-full max-w-full object-contain filter drop-shadow group-hover/ship:scale-110 transition-transform"
                            draggable={false}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium mt-0.5">Tàu 2 ô</span>
                      </div>

                      {/* Submarine */}
                      <div className="flex flex-col items-center group/ship" title="Submarine (3 ô)">
                        <div className="h-9 w-full flex items-center justify-center p-0.5">
                          <img
                            src={cfg.ships[ShipType.SUBMARINE]}
                            alt="Submarine"
                            className="max-h-full max-w-full object-contain filter drop-shadow group-hover/ship:scale-110 transition-transform"
                            draggable={false}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium mt-0.5">Tàu 3 ô</span>
                      </div>

                      {/* Cruiser */}
                      <div className="flex flex-col items-center group/ship" title="Cruiser (4 ô)">
                        <div className="h-9 w-full flex items-center justify-center p-0.5">
                          <img
                            src={cfg.ships[ShipType.CRUISER]}
                            alt="Cruiser"
                            className="max-h-full max-w-full object-contain filter drop-shadow group-hover/ship:scale-110 transition-transform"
                            draggable={false}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium mt-0.5">Tàu 4 ô</span>
                      </div>

                      {/* Battleship */}
                      <div className="flex flex-col items-center group/ship" title="Battleship (5 ô)">
                        <div className="h-9 w-full flex items-center justify-center p-0.5">
                          <img
                            src={cfg.ships[ShipType.BATTLESHIP]}
                            alt="Battleship"
                            className="max-h-full max-w-full object-contain filter drop-shadow group-hover/ship:scale-110 transition-transform"
                            draggable={false}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium mt-0.5">Tàu 5 ô</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Player Registration & Matchmaking Bar */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-5 sm:p-7 shadow-2xl border border-blue-700/60">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              
              {/* Player Name Input (Col 5) */}
              <div className="lg:col-span-5">
                <label htmlFor="playerName" className="block text-xs font-bold text-yellow-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span>🎖️</span> 2. Tên Người Chơi / Mật Danh
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="playerName"
                    value={playerName}
                    onChange={handleNameChange}
                    placeholder="Nhập tên của bạn (tối thiểu 2 ký tự)..."
                    className="w-full px-4 py-3 bg-slate-950/80 border border-blue-500/50 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 text-white placeholder-slate-500 font-medium text-base shadow-inner transition-all"
                    required
                    minLength={2}
                    maxLength={50}
                    disabled={isConnecting || showQueue || state.connectionState === GameState.CONNECTING || state.connectionState === GameState.IN_QUEUE}
                  />
                  <span className="absolute right-3 top-3.5 text-xs text-slate-400">
                    {playerName.length}/50
                  </span>
                </div>
              </div>

              {/* Selected Fleet Badge Review (Col 4) */}
              <div className="lg:col-span-4 bg-slate-950/60 rounded-xl p-3 border border-blue-800/60 flex items-center gap-3">
                <img
                  src={activeFleetConfig.commanderAvatar}
                  alt={activeFleetConfig.commanderName}
                  className="w-11 h-11 rounded-full object-cover border-2 border-yellow-400 shadow bg-slate-900 flex-shrink-0"
                  draggable={false}
                />
                <div className="min-w-0">
                  <div className="text-[11px] text-blue-300 uppercase font-semibold">Đội hình sẵn sàng:</div>
                  <div className="text-sm font-bold text-white truncate">{activeFleetConfig.name}</div>
                  <div className="text-xs text-yellow-300 truncate">{activeFleetConfig.commanderName}</div>
                </div>
              </div>

              {/* Action Submit Button (Col 3) */}
              <div className="lg:col-span-3 flex flex-col justify-center">
                <button
                  type="submit"
                  disabled={
                    !playerName.trim() || isConnecting || showQueue || state.connectionState === GameState.CONNECTING || state.connectionState === GameState.IN_QUEUE
                  }
                  className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black tracking-wide text-base shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed transition-all transform active:scale-95 border border-emerald-400/30"
                >
                  ⚔️ VÀO GHÉP TRẬN
                </button>
              </div>

            </div>

            {/* Queue / Status Alert */}
            {statusText && (
              <div className="mt-4 p-3 rounded-xl bg-blue-950/80 border border-blue-500/40 flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3 text-sm text-cyan-200 font-semibold">
                  <span className="relative flex h-3.5 w-3.5 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500"></span>
                  </span>
                  <span>{statusText}</span>
                  {(showQueue || state.connectionState === GameState.IN_QUEUE) && !state.opponentName && (
                    <span className="bg-blue-800/90 text-yellow-300 font-mono text-xs px-2.5 py-0.5 rounded-full border border-yellow-400/30 font-bold shadow-inner flex items-center gap-1">
                      <span>⏱️</span> {formatDuration(queueDuration)}
                    </span>
                  )}
                </div>
                
                {((showQueue || state.connectionState === GameState.IN_QUEUE) && !state.opponentName) && (
                  <button
                    type="button"
                    onClick={handleCancelQueue}
                    className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition shadow border border-red-400/40"
                  >
                    ✕ Hủy tìm trận
                  </button>
                )}
              </div>
            )}

            {/* Quick Rules Footer */}
            <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
              <div className="flex items-center gap-4">
                <span>📋 Quy chuẩn: <b>5 chiến hạm</b> (1 Destroyer, 2 Submarine, 1 Cruiser, 1 Battleship)</span>
              </div>
              <div className="text-slate-500">
                Chế độ bảo mật: Server-Authoritative Anti-Cheat
              </div>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
};

export default Login;
