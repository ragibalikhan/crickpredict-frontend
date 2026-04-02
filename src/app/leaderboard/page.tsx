'use client';
import { useEffect, useState } from 'react';
import { useStore } from '../../store/store';
import { API_BASE } from '../../lib/api';

type LeaderRow = {
  _id: string;
  username: string;
  coinsBalance: number;
  currentStreak: number;
  totalWins: number;
  totalLosses: number;
};

export default function LeaderboardPage() {
  const { user, token } = useStore();
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/users/leaderboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data: LeaderRow[]) => {
        setLeaders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-12 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600 rounded-full mix-blend-multiply filter blur-[150px] opacity-20"></div>
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-12">
           <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4 tracking-tighter">Global Ranking</h1>
           <p className="text-xl text-gray-400 font-light">The top predictors of the IPL season</p>
        </div>
        
        {loading ? (
           <div className="flex justify-center p-24">
             <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
           </div>
        ) : (
          <div className="bg-gray-800/60 rounded-3xl p-4 md:p-8 shadow-2xl backdrop-blur-md border border-gray-700/50">
            <div className="flex justify-between items-center px-6 py-4 text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700/50 mb-4">
               <div>Rank & Player</div>
               <div className="hidden md:block text-center flex-1">Streak/Win rate</div>
               <div className="text-right">Net Worth</div>
            </div>
            
            <div className="flex flex-col gap-3">
              {leaders.map((leader, index) => {
                const isTop3 = index < 3;
                let rankStyle = "bg-gray-700/50 text-gray-400";
                if (index === 0) rankStyle = "bg-gradient-to-br from-yellow-300 to-yellow-600 text-yellow-900 shadow-[0_0_15px_rgba(253,224,71,0.5)]";
                if (index === 1) rankStyle = "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800 shadow-[0_0_15px_rgba(209,213,219,0.5)]";
                if (index === 2) rankStyle = "bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-[0_0_15px_rgba(217,119,6,0.5)]";
                
                const isCurrentUser = user && user.username === leader.username;

                return (
                  <div key={leader._id} className={`flex items-center justify-between p-4 rounded-2xl transition-all ${isCurrentUser ? 'bg-indigo-600/20 border border-indigo-500/50 scale-[1.02]' : 'bg-gray-900/40 border border-transparent hover:border-gray-700/50'}`}>
                    <div className="flex items-center gap-4 w-1/3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${rankStyle}`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-bold flex items-center gap-2">
                           {leader.username}
                           {isCurrentUser && <span className="text-[10px] bg-indigo-500 px-2 py-0.5 rounded-full uppercase">You</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="hidden md:flex flex-1 justify-center items-center gap-6">
                       <div className="text-center">
                          <span className="text-emerald-400 font-bold block">{leader.currentStreak} 🔥</span>
                          <span className="text-xs text-gray-500">Streak</span>
                       </div>
                       <div className="text-center">
                          <span className="text-white font-bold block">{leader.totalWins}/{leader.totalWins + leader.totalLosses || 1}</span>
                          <span className="text-xs text-gray-500">W/L</span>
                       </div>
                    </div>
                    
                    <div className="w-1/3 text-right">
                      <div className="text-xl font-black text-yellow-400 tracking-tight">🪙 {leader.coinsBalance.toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
