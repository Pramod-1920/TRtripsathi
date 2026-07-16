'use client';

import { FiMapPin, FiClock } from 'react-icons/fi';

export default function TreasureHuntPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <FiMapPin size={28} className="text-amber-500" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Treasure Hunt
        </h1>
        <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
          Coming Soon
        </span>
      </div>
      
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-xl p-12 text-center border border-amber-200 dark:border-amber-800">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-6">
          <FiClock size={40} className="text-amber-600 dark:text-amber-400" />
        </div>
        
        <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
          Exciting Adventure Await!
        </h2>
        
        <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
          We're crafting an amazing treasure hunt experience for you. 
          Stay tuned for interactive clues, rewards, and adventures!
        </p>
        
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            In Development
          </span>
        </div>
      </div>
    </div>
  );
}