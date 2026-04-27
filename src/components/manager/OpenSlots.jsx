import { Calendar, Link as LinkIcon } from 'lucide-react';

export function OpenSlots({ openSlots, selectedSlot, onSelectSlot, onEditSlot, getDualTimes, timeZone }) {
  return (
    <div className="xl:col-span-4 bg-[#FAF8F5] rounded-2xl border border-[#EDE7DE] p-5 flex flex-col h-[700px]">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#EDE7DE]">
        <h2 className="font-semibold text-[#12142A] flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#335649]" strokeWidth={1.8} /> Open slots
        </h2>
        <span className="bg-[#E8F0EE] text-[#335649] px-3 py-1 rounded-full text-xs font-semibold">
          {openSlots.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {openSlots.length === 0 && (
          <div className="text-center py-10 text-[#A29A8E] font-medium border border-dashed border-[#D7D1C8] rounded-xl">
            No open slots.
          </div>
        )}
        {openSlots.map(slot => {
          const times = getDualTimes(slot.start_time, timeZone);
          const isSelected = selectedSlot?.id === slot.id;

          return (
            <div
              key={slot.id}
              className={`w-full text-left p-4 rounded-xl border transition-colors flex flex-col ${
                isSelected
                  ? 'border-[#335649] bg-[#E8F0EE]'
                  : 'border-[#EDE7DE] hover:border-[#A8C8C2] bg-white'
              }`}
            >
              <div onClick={() => onSelectSlot(slot)} className="cursor-pointer">
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="font-semibold text-base text-[#12142A] tracking-tight break-all">
                    {slot.patient_identifier}
                  </div>
                  {slot.host_manager && (
                    <span className="text-[#005682] font-semibold text-[9px] uppercase tracking-micro bg-[#CFE4EB] px-2 py-1 rounded-full whitespace-nowrap">
                      Host: {slot.host_manager.split('@')[0]}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center bg-[#FAF8F5] rounded-lg p-2 mb-3 border border-[#EDE7DE]">
                  <div className="text-[10px] font-semibold text-[#58534C] uppercase tracking-micro text-center flex-1 border-r border-[#EDE7DE]">
                    <span className="block text-[#A29A8E] mb-0.5">BPS</span>
                    {times.bps}
                  </div>
                  <div className="text-[10px] font-semibold text-[#005682] uppercase tracking-micro text-center flex-1">
                    <span className="block text-[#5A9EBD] mb-0.5">Overflow</span>
                    {times.of}
                  </div>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSlot(slot);
                }}
                className="text-xs font-semibold text-[#005682] hover:text-[#011537] hover:bg-[#CFE4EB]/70 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-dashed border-[#A8C8C2]"
              >
                <LinkIcon className="w-3 h-3" strokeWidth={1.8} />
                {slot.zoom_link ? 'Edit Zoom link' : 'Add Zoom link'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
