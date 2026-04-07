import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useDispatchData() {
  const [queue, setQueue] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState([]);

  const runSafeSweepers = async () => {
    const now = Date.now();

    // 1. Expire 30-min old queue entries
    const staleQueueTime = new Date(now - 30 * 60000).toISOString();
    const { data: expQ } = await supabase.from('queue_entries').select('id, ic_id').lt('entered_at', staleQueueTime);
    if (expQ?.length > 0) {
      const icIds = expQ.map(q => q.ic_id);
      await supabase.from('profiles').update({ current_status: 'AVAILABLE' }).in('id', icIds);
      await supabase.from('queue_entries').delete().in('id', expQ.map(q => q.id));
    }

    // 2. Expire 5-min pending assignments (Timeouts)
    const staleAssign = new Date(now - 5 * 60000).toISOString();
    const { data: expS } = await supabase.from('bps_slots').select('id, assigned_ic_id').eq('status', 'ASSIGNED').lt('assigned_at', staleAssign);
    if (expS?.length > 0) {
      const slotIds = expS.map(s => s.id);
      const icIds = expS.map(s => s.assigned_ic_id).filter(Boolean);
      await supabase.from('bps_slots').update({ status: 'OPEN', assigned_ic_id: null, assigned_at: null }).in('id', slotIds);
      if (icIds.length > 0) {
        await supabase.from('profiles').update({ current_status: 'IN_QUEUE' }).in('id', icIds);
      }
    }

    // 3. Bulletproof Slot Roll-off (Deletes OPEN slots that are older than 12 hours. No timezone math needed)
    const twelveHoursAgo = new Date(now - 12 * 60 * 60 * 1000).toISOString();
    const { data: staleSlots } = await supabase.from('bps_slots').select('id').eq('status', 'OPEN').lt('start_time', twelveHoursAgo);
    if (staleSlots?.length > 0) {
      await supabase.from('bps_slots').delete().in('id', staleSlots.map(s => s.id));
    }
  };

  const fetchData = useCallback(async () => {
    try {
      // 1. QUEUE: Strictly rely on profile status to dictate who is waiting
      const { data: qData } = await supabase.from('queue_entries')
        .select('*, profiles!inner(email, tier_rank, current_status)')
        .order('entered_at');
        
      if (qData) {
        const activeQueue = qData.filter(q => q.profiles?.current_status === 'IN_QUEUE');
        setQueue(activeQueue.sort((a, b) => (a.profiles?.tier_rank || 3) - (b.profiles?.tier_rank || 3) || new Date(a.entered_at) - new Date(b.entered_at)));
      }

      // 2. OPEN SLOTS
      const { data: oSlots } = await supabase.from('bps_slots').select('*').eq('status', 'OPEN').order('start_time');
      if (oSlots) setOpenSlots(oSlots);

      // 3. SCHEDULED SLOTS
      const { data: sSlots } = await supabase.from('bps_slots').select('*, profiles(email)').in('status', ['ASSIGNED', 'CONFIRMED']).order('start_time');
      if (sSlots) setScheduledSlots(sSlots);
    } catch (err) {
      console.error('Data Fetch Error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Non-destructive polling
    const interval = setInterval(() => { fetchData(); runSafeSweepers(); }, 3000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  return { queue, openSlots, scheduledSlots, fetchData };
}