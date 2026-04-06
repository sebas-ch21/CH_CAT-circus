import { User, Clock } from 'lucide-react';

/**
 * WaitingQueue Component
 *
 * Displays the real-time waiting queue with IC staff waiting for reassignment.
 * Shows tier rank and wait time for each entry. Allows selection for dispatch.
 *
 * @param {Object} props
 * @param {Array} props.queue - Array of queue entries with profiles
 * @param {Object} props.selectedIC - Currently selected IC
 * @param {Function} props.onSelectIC - Handler for IC selection
 */
export function WaitingQueue({ queue, selectedIC, onSelectIC }) {
  return (
    <div className="xl:col-span-4 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col h-[700px]">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <User className="w-5 h-5 text-[#5E4791]" /> Waiting Queue
        </h2>
        <span className="bg-[#F3EFF9] text-[#5E4791] px-3 py-1 rounded-full text-xs font-black">
          {queue.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {queue.map(entry => {
          const waitMinutes = Math.round((new Date() - new Date(entry.entered_at)) / 60000);

          return (
            <button
              key={entry.id}
              onClick={() => onSelectIC(entry)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                selectedIC?.id === entry.id
                  ? 'border-[#5E4791] bg-purple-50 shadow-md ring-4 ring-purple-500/20'
                  : 'border-gray-100 hover:border-gray-300 bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="font-black text-lg text-[#0F172A] truncate">
                  {entry.profiles?.email?.split('@')[0]}
                </span>
                <span className="bg-gray-800 text-white text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md shadow-sm">
                  Tier {entry.profiles?.tier_rank}
                </span>
              </div>
              <div className="text-xs font-bold text-red-500 flex items-center gap-1.5 bg-red-50 w-fit px-2 py-1 rounded-md">
                <Clock className="w-3 h-3" /> Wait: {waitMinutes} mins
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
