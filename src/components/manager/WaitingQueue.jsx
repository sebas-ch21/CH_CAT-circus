import { User, Clock } from 'lucide-react';

export function WaitingQueue({ queue, selectedIC, onSelectIC }) {
  return (
    <div className="xl:col-span-4 bg-[#FAF8F5] rounded-2xl border border-[#EDE7DE] p-5 flex flex-col h-[700px]">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#EDE7DE]">
        <h2 className="font-semibold text-[#12142A] flex items-center gap-2">
          <User className="w-5 h-5 text-[#005682]" strokeWidth={1.8} /> Waiting queue
        </h2>
        <span className="bg-[#CFE4EB] text-[#005682] px-3 py-1 rounded-full text-xs font-semibold">
          {queue.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {queue.length === 0 && (
          <div className="text-center py-10 text-[#A29A8E] font-medium border border-dashed border-[#D7D1C8] rounded-xl">
            Queue is empty.
          </div>
        )}
        {queue.map(entry => {
          const waitMinutes = Math.round((new Date() - new Date(entry.entered_at)) / 60000);
          const isSelected = selectedIC?.id === entry.id;

          return (
            <button
              key={entry.id}
              onClick={() => onSelectIC(entry)}
              className={`w-full text-left p-4 rounded-xl border transition-colors ch-focus-ring ${
                isSelected
                  ? 'border-[#005682] bg-[#CFE4EB]'
                  : 'border-[#EDE7DE] hover:border-[#A8C8C2] bg-white'
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-[#12142A] truncate">
                  {entry.profiles?.email?.split('@')[0]}
                </span>
                <span className="bg-[#12142A] text-[#FAF8F5] text-[10px] uppercase tracking-micro font-semibold px-2 py-1 rounded-full">
                  Tier {entry.profiles?.tier_rank}
                </span>
              </div>
              <div className="text-xs font-semibold text-[#9F2F2D] flex items-center gap-1.5 bg-[#FDEBEC] w-fit px-2 py-1 rounded-full">
                <Clock className="w-3 h-3" strokeWidth={1.8} /> Wait {waitMinutes}m
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
