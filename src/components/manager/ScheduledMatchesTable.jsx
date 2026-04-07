import { Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function ScheduledMatchesTable({ scheduledSlots, getDualTimes, timeZone, onDataChange }) {
  const [processingId, setProcessingId] = useState(null);

  const handleSendBackToQueue = async (slot) => {
    setProcessingId(slot.id);
    try {
      const icId = slot.assigned_ic_id;
      // 1. Kick slot back to OPEN
      await supabase.from('bps_slots').update({ status: 'OPEN', assigned_ic_id: null, assigned_at: null }).eq('id', slot.id);
      
      // 2. Put IC back in queue via Profile State Machine
      if (icId) {
        await supabase.from('profiles').update({ current_status: 'IN_QUEUE' }).eq('id', icId);
      }
      
      toast.success('Assignment Cancelled. IC returned to queue.');
      if (onDataChange) onDataChange();
    } catch (error) {
      toast.error('Failed to cancel assignment.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="overflow-x-auto border border-gray-100 rounded-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-200">
            <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status / Action</th>
            <th className="p-4 text-[10px] font-bold text-[#5E4791] uppercase tracking-widest">OF Time</th>
            <th className="p-4 text-[10px] font-bold text-[#0F172A] uppercase tracking-widest">Room ID</th>
            <th className="p-4 text-[10px] font-bold text-[#007C8C] uppercase tracking-widest">Assigned Staff</th>
          </tr>
        </thead>
        <tbody>
          {scheduledSlots.length === 0 ? (
            <tr><td colSpan="4" className="p-12 text-center text-gray-400 font-medium border-2 border-dashed border-gray-200 bg-gray-50/50">No matches confirmed today.</td></tr>
          ) : (
            scheduledSlots.map(slot => {
              const times = getDualTimes(slot.start_time, timeZone);
              const isProcessing = processingId === slot.id;

              return (
                <tr key={slot.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    {slot.status === 'ASSIGNED' ? (
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-md border bg-yellow-50 text-yellow-700 border-yellow-200">
                          PENDING (5m)
                        </span>
                        <button 
                          onClick={() => handleSendBackToQueue(slot)} 
                          disabled={isProcessing}
                          className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 text-xs font-bold rounded-lg border-2 border-gray-200 hover:border-red-200 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                        >
                          {isProcessing ? <Loader className="w-3 h-3 animate-spin"/> : 'Cancel & Re-Queue'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-md border bg-green-50 text-green-700 border-green-200">
                        CONFIRMED
                      </span>
                    )}
                  </td>
                  <td className="p-4 font-black text-[#5E4791]">{times.of}</td>
                  <td className="p-4 font-black text-[#0F172A]">{slot.patient_identifier}</td>
                  <td className="p-4 font-bold text-[#007C8C]">{slot.profiles?.email?.split('@')[0] || 'Unknown'}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}