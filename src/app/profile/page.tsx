'use client';
import { useEffect, useState } from 'react';
import { useStore } from '../../store/store';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, token } = useStore();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('http://localhost:3000/users/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setProfileData(data);
      setLoading(false);
    })
    .catch(() => setLoading(false));
  }, [token]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 text-white text-center">
        <h2 className="text-2xl font-bold">Please log in to view your profile.</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-12 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-purple-600/30 rounded-full mix-blend-multiply filter blur-[150px]"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        <h1 className="text-4xl font-black mb-8 border-b border-gray-800 pb-4">My Player Profile</h1>

        {loading ? (
          <div className="flex justify-center p-24">
             <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Profile Info */}
            <div className="lg:col-span-1 border border-gray-700/50 rounded-3xl p-8 bg-gray-800/60 backdrop-blur-md shadow-xl text-center relative overflow-hidden group">
              <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-5xl text-white font-bold mb-6 shadow-[0_0_40px_rgba(99,102,241,0.5)] border-4 border-gray-800 relative z-10 group-hover:scale-110 transition-transform duration-500">
                  {profileData?.username?.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-2xl font-black text-white">{profileData?.username}</h2>
              <p className="text-gray-400 text-sm mb-6">{profileData?.email}</p>
              
              <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
                 <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Global Rank</p>
                 <p className="text-3xl font-black text-white">#{profileData?.rank || '--'}</p>
              </div>

              <div className="mt-6">
                <Link href="/wallet" className="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-600/20">
                  Manage Wallet
                </Link>
              </div>
            </div>

            {/* Statistics */}
            <div className="lg:col-span-2 space-y-6">
               <div className="bg-gray-800/40 rounded-3xl p-8 border border-gray-700/50 backdrop-blur-sm">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="text-2xl">📊</span> Career Statistics
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700/30 text-center">
                        <p className="text-sm text-gray-400 font-medium tracking-wider mb-2">Total Balance</p>
                        <p className="text-4xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.3)]">🪙 {profileData?.coinsBalance}</p>
                     </div>
                     <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700/30 text-center">
                        <p className="text-sm text-gray-400 font-medium tracking-wider mb-2">Current Streak</p>
                        <p className="text-4xl font-black text-emerald-400">{profileData?.currentStreak || 0} 🔥</p>
                     </div>
                     <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700/30 text-center">
                        <p className="text-sm text-gray-400 font-medium tracking-wider mb-2">Highest Streak</p>
                        <p className="text-4xl font-black text-purple-400">{profileData?.highestStreak || 0} ⭐</p>
                     </div>
                     <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700/30 text-center">
                        <p className="text-sm text-gray-400 font-medium tracking-wider mb-2">Total Wins</p>
                        <p className="text-4xl font-black text-white">{profileData?.totalWins || 0}</p>
                     </div>
                  </div>
               </div>

               <div className="bg-gray-800/40 rounded-3xl p-8 border border-gray-700/50 backdrop-blur-sm">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="text-2xl">⚡</span> Recent Activity
                  </h3>
                  <div className="flex flex-col items-center justify-center py-10 bg-gray-900/30 rounded-2xl border border-gray-700/30 border-dashed">
                      <p className="text-gray-500 mb-2">Prediction history will be displayed here.</p>
                      <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 font-medium transition">
                        View Live Matches
                      </Link>
                  </div>
               </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
