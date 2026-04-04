'use client';
import { useEffect, useState } from 'react';
import { useStore } from '../store/store';

export default function ToastProvider() {
  const notifications = useStore((s) => s.notifications);
  const [activeToast, setActiveToast] = useState<any>(null);
  const [lastShownId, setLastShownId] = useState<string | null>(null);

  useEffect(() => {
    const latest = notifications[0];
    if (latest && latest._id !== lastShownId) {
      // Don't show toast for results that already have a modal (bet settlements)
      // Actually, maybe show it anyway for consistency, or skip if it's a bet result
      // Let's show it for everything for now as requested "popup notification"
      
      setActiveToast(latest);
      setLastShownId(latest._id);

      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notifications, lastShownId]);

  if (!activeToast) return null;

  const notifIcon = (type: string) => ({ info: '💬', success: '✅', warning: '⚠️', error: '🚨' }[type] || '🔔');
  const notifBg = (type: string) => ({
    info: 'bg-blue-600/90 border-blue-400/50',
    success: 'bg-emerald-600/90 border-emerald-400/50',
    warning: 'bg-yellow-600/90 border-yellow-400/50',
    error: 'bg-red-600/90 border-red-400/50',
  }[type] || 'bg-gray-800 border-gray-600');

  return (
    <div className="fixed top-20 right-4 z-[9999] animate-slide-in pointer-events-none">
      <div className={`max-w-xs md:max-w-sm px-5 py-4 rounded-2xl border shadow-2xl backdrop-blur-md flex gap-4 items-start ${notifBg(activeToast.type)} text-white`}>
        <span className="text-2xl mt-0.5">{notifIcon(activeToast.type)}</span>
        <div>
          <p className="font-bold text-sm">{activeToast.title}</p>
          <p className="text-white/80 text-xs mt-1 leading-relaxed">{activeToast.message}</p>
        </div>
        <button 
          onClick={() => setActiveToast(null)}
          className="ml-auto text-white/50 hover:text-white pointer-events-auto"
        >
          ✕
        </button>
      </div>
      <style jsx>{`
        .animate-slide-in {
          animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
