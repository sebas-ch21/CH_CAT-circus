import { Calendar, Link as LinkIcon } from 'lucide-react';

/**
 * OpenSlots Component
 *
 * Displays available overflow slots for today with BPS/OF time breakdowns.
 * Allows slot selection for dispatch and inline Zoom link editing.
 *
 * @param {Object} props
 * @param {Array} props.openSlots - Array of open slots
 * @param {Object} props.selectedSlot - Currently selected slot
 * @param {Function} props.onSelectSlot - Handler for slot selection
 * @param {Function} props.onEditSlot - Handler to open edit modal
 * @param {Function} props.getDualTimes - Helper to format BPS/OF times
 * @param {string} props.timeZone - Selected timezone for display
 */
export function OpenSlots({ openSlots, selectedSlot, onSelectSlot, onEditSlot, getDualTimes, timeZone }) {
  return (
    <div className="xl:col-span-4 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col h-[700px]">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#007C8C]" /> Open Slots
        </h2>
        <span className="bg-[#E0F5F6] text-[#007C8C] px-3 py-1 rounded-full text-xs font-black">
          {openSlots.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {openSlots.map(slot => {
          const times = getDualTimes(slot.start_time, timeZone);

          return (
            <div
              key={slot.id}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all flex flex-col ${
                selectedSlot?.id === slot.id
                  ? 'border-[#007C8C] bg-[#E0F5F6] shadow-md ring-4 ring-[#007C8C]/20'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div onClick={() => onSelectSlot(slot)} className="cursor-pointer">
                <div className="flex justify-between items-start mb-3">
                  <div className="font-black text-lg text-[#0F172A]">
                    {slot.patient_identifier}
                  </div>
                  {slot.host_manager && (
                    <span className="text-[#007C8C] font-bold text-[9px] uppercase tracking-widest bg-white border border-[#007C8C]/20 shadow-sm px-2 py-1 rounded-md">
                      Host: {slot.host_manager.split('@')[0]}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center bg-gray-50 rounded-lg p-2 mb-3 border border-gray-100">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center flex-1 border-r border-gray-200">
                    <span className="block text-gray-400 mb-0.5">BPS</span>
                    {times.bps}
                  </div>
                  <div className="text-[10px] font-bold text-[#5E4791] uppercase tracking-widest text-center flex-1">
                    <span className="block text-purple-300 mb-0.5">Overflow</span>
                    {times.of}
                  </div>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSlot(slot);
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-dashed border-blue-200"
              >
                <LinkIcon className="w-3 h-3" />
                {slot.zoom_link ? 'Edit Zoom Link' : 'Add Zoom Link'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
