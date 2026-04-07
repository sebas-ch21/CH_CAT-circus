import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useDispatchData() {
  const [queue, setQueue] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState([]);

  const runAutomatedSweeper = async () => {
    const now = Date.now();

    // 1. Clear 25-minute stale queue entries
    const staleQueueTime = new Date(now - 25 * 60000).toISOString();
    const { data: expiredQ } = await supabase.from('queue_entries').select('ic_id, id').lt('entered_at', staleQueueTime);
    if (expiredQ?.length > 0) {
      const icIds = expiredQ.map(q => q.ic_id);
      await supabase.from('profiles').update({ current_status: 'AVAILABLE' }).in('id', icIds);
      await supabase.from('queue_entries').delete().in('id', expiredQ.map(q => q.id));
    }

    // 2. Clear 5-MINUTE missed assignments (Pending Timeout)
    const staleAssignTime = new Date(now - 5 * 60000).toISOString();
    const { data: expiredS } = await supabase.from('bps_slots').select('id, assigned_ic_id').eq('status', 'ASSIGNED').lt('assigned_at', staleAssignTime);
    if (expiredS?.length > 0) {
      const slotIds = expiredS.map(s => s.id);
      const icIds = expiredS.map(s => s.assigned_ic_id).filter(Boolean);
      await supabase.from('bps_slots').update({ status: 'OPEN', assigned_ic_id: null, assigned_at: null }).in('id', slotIds);
      if (icIds.length > 0) {
        await supabase.from('profiles').update({ current_status: 'IN_QUEUE' }).in('id', icIds);
      }
    }

    // 3. Bulletproof Old Slot Roll-off (Deletes OPEN slots that started > 4 hours ago)
    const fourHoursAgo = new Date(now - 4 * 60 * 60 * 1000).toISOString();
    const { data: staleSlots } = await supabase.from('bps_slots').select('id').eq('status', 'OPEN').lt('start_time', fourHoursAgo);
    if (staleSlots?.length > 0) {
      await supabase.from('bps_slots').delete().in('id', staleSlots.map(s => s.id));
    }
  };

  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch Queue: ONLY fetch ICs strictly marked as 'IN_QUEUE'
      const { data: qData } = await supabase.from('queue_entries')
        .select('*, profiles!inner(email, tier_rank, current_status)')
        .eq('profiles.current_status', 'IN_QUEUE')
        .order('entered_at');
      
      if (qData) {
        setQueue(qData.sort((a, b) => (a.profiles?.tier_rank || 3) - (b.profiles?.tier_rank || 3) || new Date(a.entered_at) - new Date(b.entered_at)));
      }

      // 2. Fetch Open Slots
      const { data: oSlots } = await supabase.from('bps_slots').select('*').eq('status', 'OPEN').order('start_time');
      if (oSlots) setOpenSlots(oSlots);

      // 3. Fetch Scheduled Slots
      const { data: sSlots } = await supabase.from('bps_slots').select('*, profiles(email)').in('status', ['ASSIGNED', 'CONFIRMED']).order('start_time');
      if (sSlots) setScheduledSlots(sSlots);
    } catch (err) {
      console.error('FetchData Exception:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll aggressively to keep Manager and IC instantly synced
    const interval = setInterval(() => { fetchData(); runAutomatedSweeper(); }, 3000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  return { queue, openSlots, scheduledSlots, fetchData };
}