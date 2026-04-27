import { useState } from 'react';
import { Link as LinkIcon, Wand2, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { getZoomAdapter } from '../../lib/integrations';
import { useFeatureFlag, FEATURES } from '../../lib/integrations/featureFlags';

/**
 * ZoomLinkModal
 *
 * Modal for attaching a Zoom link to an open slot. Supports two paths
 * that coexist intentionally:
 *
 *   1. Manual paste            — historical behaviour, always available.
 *   2. "Generate" (live/mock)  — programmatic creation via the
 *      Zoom adapter (see src/lib/zoom). Gated behind the
 *      `zoom_meeting_api` feature flag so it only appears when the
 *      integration is fully go-live'd.
 *
 * Any failure from the Generate path falls back to the manual paste
 * input — we never lock the admin out of a working dispatch.
 *
 * @param {Object}  props
 * @param {Object}  props.slot     The bps_slot row being edited.
 * @param {Function} props.onClose Close handler.
 * @param {Function} props.onSave  Callback after save completes.
 */
export function ZoomLinkModal({ slot, onClose, onSave }) {
  const [zoomLinkInput, setZoomLinkInput] = useState(slot?.zoom_link || '');
  const [generating, setGenerating] = useState(false);

  const zoomApiEnabled = useFeatureFlag(FEATURES.ZOOM_MEETING_API);

  const saveSlotEdit = async () => {
    await supabase.from('bps_slots').update({ zoom_link: zoomLinkInput, zoom_source: 'manual' }).eq('id', slot.id);
    onSave();
    onClose();
  };

  /**
   * Calls the configured Zoom adapter (mock or live) to generate a
   * meeting link. On success, we write the link back to the slot in
   * the edge function; we just refresh the input here so the admin
   * can eyeball the result before pressing Save.
   */
  const generateLink = async () => {
    setGenerating(true);
    try {
      const adapter = getZoomAdapter();
      const result = await adapter.generateMeetingLink({ slot });
      setZoomLinkInput(result.joinUrl);
      toast.success(`Zoom meeting created (${result.source}).`);
    } catch (err) {
      toast.error(`Zoom link generation failed: ${err.message || 'unknown error'}`);
    } finally {
      setGenerating(false);
    }
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
          className="w-full px-4 py-3 bg-[#FAF8F5] border border-[#D7D1C8] rounded-xl font-medium focus:border-[#005682] focus:bg-white outline-none mb-4 text-[#12142A]"
        />

        {zoomApiEnabled && (
          <button
            type="button"
            onClick={generateLink}
            disabled={generating}
            className="w-full mb-4 py-3 rounded-xl font-semibold border border-[#005682] text-[#005682] hover:bg-[#CFE4EB] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {generating ? 'Generating…' : 'Generate via Zoom'}
          </button>
        )}

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
