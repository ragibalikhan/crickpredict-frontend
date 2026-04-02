import Link from 'next/link';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-gray-900 overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-30 top-10 left-10"></div>
        <div className="absolute w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-30 bottom-10 right-10"></div>
      </div>
      
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 md:p-24 text-center">
        <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md">
          <span className="text-indigo-400 font-semibold text-sm tracking-widest uppercase">The Next Gen of Fantasy Cricket</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 mb-6 drop-shadow-sm leading-tight">
          CrickPredict
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl font-light">
          Predict live IPL balls, overs, and batsman performance in real-time. Use your skill to accumulate coins and climb the global leaderboards.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-6">
          <Link href="/login" className="px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-bold text-lg transition-all transform hover:-translate-y-1 shadow-[0_10px_40px_rgba(79,70,229,0.4)] flex items-center justify-center gap-2">
            Start Playing <span className="text-2xl leading-none">&rarr;</span>
          </Link>
          <Link href="/register" className="px-10 py-5 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 backdrop-blur-md text-white rounded-2xl font-bold text-lg transition-all transform hover:-translate-y-1 shadow-lg">
            Create Free Account
          </Link>
        </div>
        
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
          <div className="p-8 rounded-3xl bg-gray-800/40 border border-gray-700/50 backdrop-blur-sm">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-bold text-white mb-2">Live Ball-by-Ball</h3>
            <p className="text-gray-400">Lock your predictions before the bowler delivers. Earn high multipliers on wickets and sixes.</p>
          </div>
          <div className="p-8 rounded-3xl bg-gray-800/40 border border-gray-700/50 backdrop-blur-sm">
            <div className="text-4xl mb-4">🔥</div>
            <h3 className="text-xl font-bold text-white mb-2">Combo Streaks</h3>
            <p className="text-gray-400">Guess correctly multiple times in a row to activate massive streak multipliers.</p>
          </div>
          <div className="p-8 rounded-3xl bg-gray-800/40 border border-gray-700/50 backdrop-blur-sm">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-xl font-bold text-white mb-2">Global Leaderboards</h3>
            <p className="text-gray-400">Compete against thousands daily. Top predictors win real cash prizes at the season end.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
