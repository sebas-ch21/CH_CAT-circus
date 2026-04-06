import { CircleCheck as CheckCircle2 } from 'lucide-react';

/**
 * ScheduledMatchesTable Component
 *
 * Displays today's confirmed and pending (assigned) matches in a table format.
 *
 * @param {Object} props
 * @param {Array} props.scheduledSlots - Array of assigned/confirmed slots
 * @param {Function} props.getDualTimes - Helper to format BPS/OF times
 * @param {string} props.timeZone - Selected timezone
 */
export function ScheduledMatchesTable({ scheduledSlots, getDualTimes, timeZone }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex-1">
      <h2 className="text-xl font-bold text-[#0F172A] mb-6 flex items-center gap-2">
        <CheckCircle2 className="w-6 h-6 text-green-500" /> Today's Matches
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50">
              <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Status
              </th>
              <th className="p-4 text-[10px] font-bold text-[#5E4791] uppercase tracking-widest">
                OF Time
              </th>
              <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                BPS Time
              </th>
              <th className="p-4 text-[10px] font-bold text-[#0F172A] uppercase tracking-widest">
                Room ID
              </th>
              <th className="p-4 text-[10px] font-bold text-[#007C8C] uppercase tracking-widest">
                Assigned Staff
              </th>
              <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                OF Host
              </th>
            </tr>
          </thead>
          <tbody>
            {scheduledSlots.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="p-12 text-center text-gray-400 font-medium border-2 border-dashed border-gray-200 rounded-xl mt-4"
                >
                  No slots scheduled yet today.
                </td>
              </tr>
            ) : (
              scheduledSlots.map(slot => {
                const times = getDualTimes(slot.start_time, timeZone);
                return (
                  <tr
                    key={slot.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-4">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                          slot.status === 'CONFIRMED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {slot.status === 'ASSIGNED' ? 'PENDING (5m)' : 'CONFIRMED'}
                      </span>
                    </td>
                    <td className="p-4 font-black text-[#5E4791]">{times.of}</td>
                    <td className="p-4 font-bold text-gray-400">{times.bps}</td>
                    <td className="p-4 font-black text-[#0F172A]">{slot.patient_identifier}</td>
                    <td className="p-4 font-bold text-[#007C8C]">
                      {slot.profiles?.email?.split('@')[0] || 'Unknown'}
                    </td>
                    <td className="p-4 font-bold text-gray-600">
                      {slot.host_manager?.split('@')[0] || 'Unassigned'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
