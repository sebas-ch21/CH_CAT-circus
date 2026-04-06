import { useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * ZoomLinkModal Component
 *
 * Modal for adding/editing Zoom links on open slots.
 *
 * @param {Object} props
 * @param {Object} props.slot - The slot being edited
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSave - Callback after save
 */
export function ZoomLinkModal({ slot, onClose, onSave }) {
  const [zoomLinkInput, setZoomLinkInput] = useState(slot?.zoom_link || '');

  const saveSlotEdit = async () => {
    await supabase.from('bps_slots').update({ zoom_link: zoomLinkInput }).eq('id', slot.id);
    onSave();
    onClose();
  };

  if (!slot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/80 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 p-8 text-center">
        <LinkIcon className="w-12 h-12 text-[#5E4791] mx-auto mb-4" />
        <h2 className="text-2xl font-black text-[#0F172A] mb-2">Add Zoom Link</h2>
        <p className="text-gray-500 font-medium mb-6">
          Attach a meeting link to Room <strong>{slot.patient_identifier}</strong> before dispatching.
        </p>
        <input
          type="text"
          placeholder="https://zoom.us/j/..."
          value={zoomLinkInput}
          onChange={(e) => setZoomLinkInput(e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-medium focus:border-[#5E4791] focus:ring-0 outline-none mb-6"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={saveSlotEdit}
            className="flex-1 py-3 rounded-xl font-bold bg-[#5E4791] text-white hover:bg-[#4a3872] shadow-md"
          >
            Save Link
          </button>
        </div>
      </div>
    </div>
  );
}
