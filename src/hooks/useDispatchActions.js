import { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useDispatchActions() {
  const [isDispatching, setIsDispatching] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const dispatchIC = async (slotId, icId, zoomLink) => {
    setIsDispatching(true);
    try {
      const { data, error } = await supabase.rpc('manager_dispatch_ic', {
        p_slot_id: slotId,
        p_ic_id: icId,
        p_zoom_link: zoomLink || ''
      });
      
      if (error) throw error;
      
      toast.success('Dispatched! Awaiting IC Confirmation.');
      return { success: true };
    } catch (err) {
      toast.error(err.message || 'Dispatch failed.');
      console.error('[Supabase Error]:', err);
      return { success: false, error: err };
    } finally {
      setIsDispatching(false);
    }
  };

  const enterQueue = async (icId) => {
    setIsQueueing(true);
    try {
      const { data, error } = await supabase.rpc('enter_ic_queue', { p_ic_id: icId });
      
      if (error) throw error;
      
      toast.success('Entered Queue');
      return { success: true };
    } catch (err) {
      toast.error(err.message || 'Failed to enter queue');
      console.error('[Supabase Error]:', err);
      return { success: false, error: err };
    } finally {
      setIsQueueing(false);
    }
  };

  const exitQueue = async (icId) => {
    setIsQueueing(true);
    try {
      const { data, error } = await supabase.rpc('exit_ic_queue', { p_ic_id: icId });
      
      if (error) throw error;
      
      toast.success('Exited Queue');
      return { success: true };
    } catch (err) {
      toast.error(err.message || 'Failed to exit queue');
      console.error('[Supabase Error]:', err);
      return { success: false, error: err };
    } finally {
      setIsQueueing(false);
    }
  };

  const acceptMatch = async ({ slotId, icId, icEmail, managerEmail, patientIdentifier, startTime, tierRank }) => {
    setIsAccepting(true);
    try {
      const { data, error } = await supabase.rpc('ic_accept_match', {
        p_slot_id: slotId,
        p_ic_id: icId,
        p_ic_email: icEmail,
        p_manager_email: managerEmail,
        p_patient_identifier: patientIdentifier,
        p_start_time: startTime,
        p_tier_rank: tierRank
      });
      
      if (error) throw error;
      
      toast.success('Match Confirmed!');
      return { success: true };
    } catch (err) {
      toast.error(err.message || 'Failed to confirm. Assignment may have expired.');
      console.error('[Supabase Error]:', err);
      return { success: false, error: err };
    } finally {
      setIsAccepting(false);
    }
  };

  const rejectMatch = async (slotId, icId) => {
    setIsRejecting(true);
    try {
      const { data, error } = await supabase.rpc('reject_or_cancel_match', {
        p_slot_id: slotId,
        p_ic_id: icId
      });
      
      if (error) throw error;
      
      toast.success('Assignment rejected. Re-entered queue.');
      return { success: true };
    } catch (err) {
      toast.error(err.message || 'Failed to reject assignment.');
      console.error('[Supabase Error]:', err);
      return { success: false, error: err };
    } finally {
      setIsRejecting(false);
    }
  };

  return {
    isDispatching, dispatchIC,
    isQueueing, enterQueue, exitQueue,
    isAccepting, acceptMatch,
    isRejecting, rejectMatch
  };
}
