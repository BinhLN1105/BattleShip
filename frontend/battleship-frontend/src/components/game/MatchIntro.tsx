/**
 * MatchIntro Component - Màn hình giới thiệu đối thủ & đếm ngược vào trận
 */

import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { FLEET_CONFIGS } from '../../types/game';

export const MatchIntro: React.FC = () => {
  const { state, dispatch } = useGame();
  const [countdown, setCountdown] = useState(4);

  const myFleetConfig = FLEET_CONFIGS[state.myFleet] || FLEET_CONFIGS.modern;
  const oppFleetConfig = FLEET_CONFIGS[state.opponentFleet] || FLEET_CONFIGS.modern;

  useEffect(() => {
    if (countdown <= 0) {
      dispatch({ type: 'START_SHIP_PLACEMENT' });
      return;
    }
    const timer = setInterval(() => {
      setCountdown(c => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown, dispatch]);

  const handleSkip = () => {
    dispatch({ type: 'START_SHIP_PLACEMENT' });
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center relative p-4 flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ backgroundImage: "url('/images/ocean-background.jpg')" }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Dark Tactical Backdrop */}
      <div className="fixed inset-0 bg-blue-950/85 backdrop-blur-md pointer-events-none z-0" />

      {/* Main Content */}
      <div className="relative z-10 max-w-5xl w-full flex flex-col items-center animate-in zoom-in-95 duration-500">
        
        {/* Header Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-300 text-xs sm:text-sm font-black px-4 py-1 rounded-full border border-yellow-500/40 uppercase tracking-widest mb-3 animate-pulse">
            ⚔️ ĐÃ TÌM THẤY ĐỐI THỦ
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-white to-blue-200 uppercase tracking-wider drop-shadow">
            HẢI CHIẾN ĐỐI KHÁNG
          </h1>
          <p className="text-blue-200/80 text-xs sm:text-sm mt-1">
            Phòng đấu: <span className="font-mono text-yellow-300 font-bold">{state.roomId ? state.roomId.slice(0, 8) : '...'}</span>
          </p>
        </div>

        {/* VS Battle Cards Container */}
        <div className="w-full grid grid-cols-1 md:grid-cols-11 gap-4 items-center mb-8">
          
          {/* Commander 1: Player (Cols 1-5) */}
          <div className="md:col-span-5 bg-gradient-to-br from-blue-900/90 to-slate-900/90 rounded-2xl p-6 border-2 border-emerald-400/80 shadow-[0_0_30px_rgba(16,185,129,0.3)] flex flex-col items-center text-center transform md:hover:scale-[1.02] transition-transform">
            <span className="bg-emerald-500 text-slate-950 font-black text-xs px-3 py-0.5 rounded-full uppercase tracking-wider mb-4 shadow">
              CHỈ HUY CỦA BẠN
            </span>
            <div className="relative mb-4">
              <img
                src={myFleetConfig.commanderAvatar}
                alt={myFleetConfig.commanderName}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-emerald-400 shadow-xl bg-slate-950"
                style={{ width: '120px', height: '120px' }}
                draggable={false}
              />
              <span className="absolute bottom-1 right-1 bg-emerald-500 w-5 h-5 rounded-full border-4 border-blue-900" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">{state.playerName}</h2>
            <div className="text-yellow-300 text-sm font-bold mt-0.5">{myFleetConfig.commanderName}</div>
            <div className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mt-1 bg-emerald-950/60 px-3 py-1 rounded-md border border-emerald-800/60">
              {myFleetConfig.name}
            </div>
            <p className="text-blue-200/70 text-xs italic mt-3 line-clamp-2 max-w-xs">
              "{myFleetConfig.quote}"
            </p>
          </div>

          {/* VS Center Emblem (Col 6) */}
          <div className="md:col-span-1 flex flex-col items-center justify-center my-2 md:my-0">
            <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-red-600 to-amber-500 text-white font-black text-2xl sm:text-3xl shadow-[0_0_40px_rgba(239,68,68,0.7)] border-4 border-yellow-300 animate-pulse">
              VS
            </div>
          </div>

          {/* Commander 2: Opponent (Cols 7-11) */}
          <div className="md:col-span-5 bg-gradient-to-bl from-blue-900/90 to-slate-900/90 rounded-2xl p-6 border-2 border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.3)] flex flex-col items-center text-center transform md:hover:scale-[1.02] transition-transform">
            <span className="bg-red-500 text-white font-black text-xs px-3 py-0.5 rounded-full uppercase tracking-wider mb-4 shadow">
              ĐỐI THỦ THÁCH ĐẤU
            </span>
            <div className="relative mb-4">
              <img
                src={oppFleetConfig.commanderAvatar}
                alt={oppFleetConfig.commanderName}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-red-500 shadow-xl bg-slate-950"
                style={{ width: '120px', height: '120px' }}
                draggable={false}
              />
              <span className="absolute bottom-1 right-1 bg-red-500 w-5 h-5 rounded-full border-4 border-blue-900" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">{state.opponentName || 'Đối thủ bí ẩn'}</h2>
            <div className="text-yellow-300 text-sm font-bold mt-0.5">{oppFleetConfig.commanderName}</div>
            <div className="text-red-400 text-xs font-semibold uppercase tracking-wider mt-1 bg-red-950/60 px-3 py-1 rounded-md border border-red-800/60">
              {oppFleetConfig.name}
            </div>
            <p className="text-blue-200/70 text-xs italic mt-3 line-clamp-2 max-w-xs">
              "{oppFleetConfig.quote}"
            </p>
          </div>

        </div>

        {/* Countdown Box & Skip Action */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-slate-900/90 border border-blue-500/40 px-6 py-2.5 rounded-2xl shadow-xl flex items-center gap-3">
            <span className="text-blue-200 text-sm font-medium">Bố trí chiến hạm sau:</span>
            <span className="text-yellow-300 font-black text-2xl font-mono animate-bounce w-8 text-center">
              {countdown}s
            </span>
          </div>

          <button
            onClick={handleSkip}
            className="text-xs text-blue-300 hover:text-white underline underline-offset-4 transition-colors font-semibold"
          >
            Bỏ qua & Xếp thuyền ngay ➔
          </button>
        </div>

      </div>
    </div>
  );
};

export default MatchIntro;
