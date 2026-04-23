import { Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function ScheduledMatchesTable({ scheduledSlots, getDualTimes, timeZone, onDataChange }) {
  const [processingId, setProcessingId] = useState(null);

  const handleSendBackToQueue = async (slot) => {
    setProcessingId(slot.id);
    try {
      const { error } = await supabase.rpc('reject_or_cancel_match', {
        p_slot_id: slot.id,
        p_ic_id: slot.assigned_ic_id
      });

      if (error) throw error;

      toast.success('Assignment revoked. IC returned to queue.');
      if (onDataChange) onDataChange();
    } catch (err) {
      const msg = err?.message || err?.details || 'Failed to cancel assignment.';
      toast.error(msg);
      console.error('Cancel RPC error:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="overflow-x-auto border border-[#EDE7DE] rounded-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#FAF8F5] border-b border-[#EDE7DE]">
            <th className="p-4 text-[10px] font-semibold text-[#58534C] uppercase tracking-micro">Status / Action</th>
            <th className="p-4 text-[10px] font-semibold text-[#005682] uppercase tracking-micro">OF Time</th>
            <th className="p-4 text-[10px] font-semibold text-[#12142A] uppercase tracking-micro">Room ID</th>
            <th className="p-4 text-[10px] font-semibold text-[#335649] uppercase tracking-micro">Assigned staff</th>
          </tr>
        </thead>
        <tbody>
          {scheduledSlots.length === 0 ? (
            <tr>
              <td colSpan="4" className="p-12 text-center text-[#A29A8E] font-medium border border-dashed border-[#D7D1C8] bg-[#FAF8F5]">
                No matches confirmed today.
              </td>
            </tr>
          ) : (
            scheduledSlots.map(slot => {
              const times = getDualTimes(slot.start_time, timeZone);
              const isProcessing = processingId === slot.id;

              return (
                <tr key={slot.id} className="border-b border-[#EDE7DE] hover:bg-[#FAF8F5] transition-colors">
                  <td className="p-4">
                    {slot.status === 'ASSIGNED' ? (
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-semibold uppercase tracking-micro px-3 py-1 rounded-full bg-[#FBF3DB] text-[#956400]">
                          Pending (5m)
                        </span>
                        <button
                          onClick={() => handleSendBackToQueue(slot)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 bg-white hover:bg-[#FDEBEC] text-[#9F2F2D] text-xs font-semibold rounded-full border border-[#D7D1C8] hover:border-[#F2C9CC] transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {isProcessing ? <Loader className="w-3 h-3 animate-spin" /> : 'Cancel & re-queue'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-micro px-3 py-1 rounded-full bg-[#E8F0EE] text-[#335649]">
                        Confirmed
                      </span>
                    )}
                  </td>
                  <td className="p-4 font-semibold text-[#005682]">{times.of}</td>
                  <td className="p-4 font-semibold text-[#12142A]">{slot.patient_identifier}</td>
                  <td className="p-4 font-medium text-[#335649]">{slot.ic_email?.split('@')[0] || 'Unknown'}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
