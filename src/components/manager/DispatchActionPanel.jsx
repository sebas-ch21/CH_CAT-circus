import { useState } from 'react';
import { CircleCheck, User, Calendar, Loader, CircleAlert as AlertCircle, X, Link as LinkIcon } from 'lucide-react';
import { useDispatchActions } from '../../hooks/useDispatchActions';

export function DispatchActionPanel({ selectedIC, selectedSlot, onDispatchComplete, getDualTimes, timeZone }) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [zoomLinkInput, setZoomLinkInput] = useState('');
  const { isDispatching, dispatchIC } = useDispatchActions();

  const openConfirmModal = () => {
    setZoomLinkInput(selectedSlot?.zoom_link || '');
    setShowConfirmModal(true);
  };

  const executeDispatch = async () => {
    if (!selectedIC || !selectedSlot) return;

    const { success } = await dispatchIC(
      selectedSlot.id,
      selectedIC.ic_id,
      zoomLinkInput || selectedSlot.zoom_link || ''
    );

    if (success) {
      setShowConfirmModal(false);
      if (onDispatchComplete) onDispatchComplete();
    }
  };

  return (
    <>
      <div className="xl:col-span-4 bg-[#12142A] rounded-2xl p-6 text-[#FAF8F5] flex flex-col h-[700px] relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-[320px] h-[320px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(closest-side, #005682, transparent 70%)' }}
        />
        <h2 className="relative font-display text-2xl mb-6 flex items-center gap-2">
          <CircleCheck className="w-5 h-5 text-[#5A9EBD]" strokeWidth={1.8} /> Match &amp; dispatch
        </h2>

        <div className="space-y-4 flex-1 relative">
          <div className="bg-[#FAF8F5]/5 p-5 rounded-xl border border-[#FAF8F5]/10">
            <p className="text-[10px] text-[#A8C8C2] font-semibold uppercase tracking-micro mb-2 flex items-center gap-2">
              <User className="w-3 h-3" strokeWidth={1.8} /> Selected IC
            </p>
            {selectedIC ? (
              <p className="font-display text-2xl text-[#FAF8F5] tracking-tight">{selectedIC.profiles?.email?.split('@')[0] || 'Selected User'}</p>
            ) : (
              <p className="text-[#A8C8C2]/70 italic font-medium">Waiting for selection...</p>
            )}
          </div>

          <div className="bg-[#FAF8F5]/5 p-5 rounded-xl border border-[#FAF8F5]/10">
            <p className="text-[10px] text-[#A8C8C2] font-semibold uppercase tracking-micro mb-2 flex items-center gap-2">
              <Calendar className="w-3 h-3" strokeWidth={1.8} /> Selected room
            </p>
            {selectedSlot ? (
              <div>
                <p className="font-display text-2xl text-[#FAF8F5] mb-3 tracking-tight">{selectedSlot.patient_identifier}</p>
                <div className="bg-[#011537] rounded-lg px-3 py-2 text-sm font-medium text-[#CFE4EB]">
                  OF Time: <span className="text-[#5A9EBD] font-semibold">{getDualTimes(selectedSlot.start_time, timeZone).of}</span>
                </div>
              </div>
            ) : (
              <p className="text-[#A8C8C2]/70 italic font-medium">Waiting for selection...</p>
            )}
          </div>
        </div>

        <button
          onClick={openConfirmModal}
          disabled={!selectedIC || !selectedSlot}
          className="relative w-full mt-auto py-5 rounded-xl font-semibold text-base transition-colors disabled:opacity-40 disabled:bg-[#495654] disabled:text-[#A8C8C2] bg-[#FAF8F5] text-[#12142A] hover:bg-[#CFE4EB] ch-focus-ring"
        >
          Initiate dispatch
        </button>
      </div>

      {showConfirmModal && selectedIC && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#12142A]/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden ch-rise">
            <div className="p-6 border-b border-[#EDE7DE] flex justify-between items-center bg-[#FAF8F5]">
              <h2 className="font-display text-2xl text-[#12142A] flex items-center gap-2 tracking-tight">
                <AlertCircle className="w-5 h-5 text-[#005682]" strokeWidth={1.8} /> Confirm assignment
              </h2>
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isDispatching}
                className="text-[#58534C] hover:text-[#12142A] transition-colors"
              >
                <X className="w-6 h-6" strokeWidth={1.8} />
              </button>
            </div>

            <div className="p-8">
              <div className="bg-[#FAF8F5] border border-[#EDE7DE] rounded-2xl p-5 space-y-4 mb-6">
                <div className="flex justify-between items-center pb-4 border-b border-[#EDE7DE]">
                  <span className="text-[11px] font-semibold text-[#58534C] uppercase tracking-micro">Staff member</span>
                  <span className="font-semibold text-[#005682] text-base">{selectedIC.profiles?.email?.split('@')[0] || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-[#EDE7DE]">
                  <span className="text-[11px] font-semibold text-[#58534C] uppercase tracking-micro">Room ID</span>
                  <span className="font-semibold text-[#12142A] text-base">{selectedSlot.patient_identifier}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-[#58534C] uppercase tracking-micro">Overflow time</span>
                  <span className="font-semibold text-[#005682] text-base bg-[#CFE4EB] px-3 py-1 rounded-full">
                    {getDualTimes(selectedSlot.start_time, timeZone).of}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#58534C] uppercase tracking-micro mb-2 flex items-center gap-1.5">
                  <LinkIcon className="w-3 h-3" strokeWidth={1.8} /> Zoom link (required for IC)
                </label>
                <input
                  type="text"
                  placeholder="Paste Zoom link here..."
                  value={zoomLinkInput}
                  onChange={(e) => setZoomLinkInput(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FAF8F5] border border-[#D7D1C8] rounded-xl font-medium focus:border-[#005682] focus:bg-white outline-none text-[#12142A]"
                />
              </div>
            </div>

            <div className="p-6 flex gap-3 bg-[#FAF8F5] border-t border-[#EDE7DE]">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isDispatching}
                className="flex-1 py-3.5 rounded-xl font-semibold text-[#495654] bg-white border border-[#D7D1C8] hover:bg-[#F1ECE7] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDispatch}
                disabled={isDispatching}
                className="flex-1 py-3.5 rounded-xl font-semibold bg-[#12142A] text-[#FAF8F5] hover:bg-[#011537] transition-colors flex justify-center items-center gap-2 ch-focus-ring"
              >
                {isDispatching ? <><Loader className="w-5 h-5 animate-spin" /> Routing...</> : 'Route IC now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
