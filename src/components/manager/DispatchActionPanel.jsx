import { useState } from 'react';
import { CircleCheck, User, Calendar, Loader, CircleAlert as AlertCircle, X, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export function DispatchActionPanel({ selectedIC, selectedSlot, onDispatchComplete, getDualTimes, timeZone }) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [zoomLinkInput, setZoomLinkInput] = useState('');
  const [dispatching, setDispatching] = useState(false);

  const openConfirmModal = () => {
    setZoomLinkInput(selectedSlot?.zoom_link || '');
    setShowConfirmModal(true);
  };

  const executeDispatch = async () => {
    if (!selectedIC || !selectedSlot) return;
    setDispatching(true);
    try {
      // 1. Assign the slot
      const { error: slotErr } = await supabase.from('bps_slots').update({
        status: 'ASSIGNED',
        assigned_ic_id: selectedIC.ic_id,
        assigned_at: new Date().toISOString(),
        zoom_link: zoomLinkInput || selectedSlot.zoom_link
      }).eq('id', selectedSlot.id);
      if (slotErr) throw slotErr;

      // 2. State Machine Update: Set IC to PENDING_MATCH
      // This instantly removes them from the Manager's queue view and triggers the IC Dashboard logic
      await supabase.from('profiles').update({ current_status: 'PENDING_MATCH' }).eq('id', selectedIC.ic_id);

      toast.success('Dispatched! Awaiting IC Confirmation.');
      setShowConfirmModal(false);
      if (onDispatchComplete) onDispatchComplete();
    } catch (error) {
      toast.error('Dispatch failed.');
      console.error(error);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <>
      <div className="xl:col-span-4 bg-[#0F172A] rounded-2xl p-6 shadow-xl text-white flex flex-col h-[700px] relative overflow-hidden">
        <h2 className="text-xl font-black mb-6 flex items-center gap-2">
          <CircleCheck className="w-5 h-5 text-[#007C8C]" /> Match & Dispatch
        </h2>

        <div className="space-y-4 flex-1">
          <div className="bg-white/5 p-5 rounded-xl border border-white/10">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
              <User className="w-3 h-3" /> Selected Staff (IC)
            </p>
            {selectedIC ? (
              <p className="font-bold text-xl text-white">{selectedIC.profiles.email.split('@')[0]}</p>
            ) : (
              <p className="text-gray-500 italic font-medium">Waiting for selection...</p>
            )}
          </div>

          <div className="bg-white/5 p-5 rounded-xl border border-white/10">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Selected Room (Slot)
            </p>
            {selectedSlot ? (
              <div>
                <p className="font-bold text-xl text-white mb-2">{selectedSlot.patient_identifier}</p>
                <div className="bg-black/30 rounded-lg p-3 text-sm font-medium">
                  OF Time: <span className="text-purple-300 font-bold">{getDualTimes(selectedSlot.start_time, timeZone).of}</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 italic font-medium">Waiting for selection...</p>
            )}
          </div>
        </div>

        <button
          onClick={openConfirmModal}
          disabled={!selectedIC || !selectedSlot}
          className="w-full mt-auto py-5 rounded-xl font-black text-lg transition-all disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-400 bg-white text-[#0F172A] hover:bg-gray-200"
        >
          Initiate Dispatch
        </button>
      </div>

      {showConfirmModal && selectedIC && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-[#007C8C]" /> Confirm Assignment
              </h2>
              <button onClick={() => setShowConfirmModal(false)} disabled={dispatching} className="text-gray-400 hover:text-gray-900 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              <div className="bg-gray-50 border-2 border-gray-100 rounded-2xl p-5 shadow-sm space-y-4 mb-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Staff Member</span>
                  <span className="font-black text-[#007C8C] text-lg">{selectedIC.profiles.email.split('@')[0]}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Room ID</span>
                  <span className="font-black text-[#0F172A] text-lg">{selectedSlot.patient_identifier}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Overflow Time</span>
                  <span className="font-black text-[#5E4791] text-lg bg-purple-50 px-3 py-1 rounded-lg">
                    {getDualTimes(selectedSlot.start_time, timeZone).of}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <LinkIcon className="w-3 h-3" /> Zoom Link (Required for IC)
                </label>
                <input type="text" placeholder="Paste Zoom link here..." value={zoomLinkInput} onChange={(e) => setZoomLinkInput(e.target.value)} className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium focus:border-[#5E4791] focus:ring-0 outline-none" />
              </div>
            </div>

            <div className="p-6 flex gap-3 bg-gray-50 border-t border-gray-100">
              <button onClick={() => setShowConfirmModal(false)} disabled={dispatching} className="flex-1 py-4 rounded-xl font-bold text-gray-600 bg-white border-2 border-gray-200 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={executeDispatch} disabled={dispatching} style={{ backgroundColor: '#0F172A', color: '#ffffff' }} className="flex-1 py-4 rounded-xl font-black shadow-lg hover:opacity-90 transition-opacity flex justify-center items-center gap-2">
                {dispatching ? <><Loader className="w-5 h-5 animate-spin" /> Routing...</> : 'Route IC Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}