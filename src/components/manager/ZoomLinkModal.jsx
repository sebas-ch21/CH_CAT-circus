import { useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function ZoomLinkModal({ slot, onClose, onSave }) {
  const [zoomLinkInput, setZoomLinkInput] = useState(slot?.zoom_link || '');

  const saveSlotEdit = async () => {
    await supabase.from('bps_slots').update({ zoom_link: zoomLinkInput }).eq('id', slot.id);
    onSave();
    onClose();
  };

  if (!slot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#12142A]/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden p-8 text-center ch-rise border border-[#EDE7DE]">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#CFE4EB] text-[#005682] mx-auto mb-4">
          <LinkIcon className="w-7 h-7" strokeWidth={1.8} />
        </div>
        <h2 className="font-display text-3xl text-[#12142A] mb-2 tracking-tight">Add Zoom link</h2>
        <p className="text-[#495654] font-medium mb-6">
          Attach a meeting link to Room <strong className="text-[#12142A]">{slot.patient_identifier}</strong> before dispatching.
        </p>
        <input
          type="text"
          placeholder="https://zoom.us/j/..."
          value={zoomLinkInput}
          onChange={(e) => setZoomLinkInput(e.target.value)}
          className="w-full px-4 py-3 bg-[#FAF8F5] border border-[#D7D1C8] rounded-xl font-medium focus:border-[#005682] focus:bg-white outline-none mb-6 text-[#12142A]"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-semibold text-[#495654] bg-white border border-[#D7D1C8] hover:bg-[#F1ECE7] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveSlotEdit}
            className="flex-1 py-3 rounded-xl font-semibold bg-[#12142A] text-[#FAF8F5] hover:bg-[#011537] transition-colors"
          >
            Save link
          </button>
        </div>
      </div>
    </div>
  );
}
