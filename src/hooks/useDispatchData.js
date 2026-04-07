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

    // 3. Roll-off OPEN slots older than 12 hours
    const twelveHoursAgo = new Date(now - 12 * 60 * 60 * 1000).toISOString();
    const { data: staleSlots } = await supabase.from('bps_slots').select('id').eq('status', 'OPEN').lt('start_time', twelveHoursAgo);
    if (staleSlots?.length > 0) {
      await supabase.from('bps_slots').delete().in('id', staleSlots.map(s => s.id));
    }
  };

  const fetchData = useCallback(async () => {
    try {
      // A. Fetch All Profiles (To manually map emails and prevent JOIN failures)
      const { data: allProfiles } = await supabase.from('profiles').select('id, email, tier_rank, current_status');
      const profileMap = {};
      if (allProfiles) {
        allProfiles.forEach(p => profileMap[p.id] = p);
      }

      // B. Fetch Queue
      const { data: qData } = await supabase.from('queue_entries').select('*').order('entered_at');
      if (qData) {
        const enrichedQueue = qData
          .map(q => ({ ...q, profiles: profileMap[q.ic_id] }))
          .filter(q => q.profiles?.current_status === 'IN_QUEUE');
        
        setQueue(enrichedQueue.sort((a, b) => (a.profiles?.tier_rank || 3) - (b.profiles?.tier_rank || 3) || new Date(a.entered_at) - new Date(b.entered_at)));
      }

      // C. Fetch Open Slots
      const { data: oSlots } = await supabase.from('bps_slots').select('*').eq('status', 'OPEN').order('start_time');
      if (oSlots) setOpenSlots(oSlots);

      // D. Fetch Scheduled Slots
      const { data: sSlots } = await supabase.from('bps_slots').select('*').in('status', ['ASSIGNED', 'CONFIRMED']).order('start_time');
      if (sSlots) {
        const mappedSlots = sSlots.map(slot => ({
          ...slot,
          ic_email: profileMap[slot.assigned_ic_id]?.email || 'Unknown'
        }));
        setScheduledSlots(mappedSlots);
      }
    } catch (err) {
      console.error('Data Fetch Error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => { fetchData(); runSafeSweepers(); }, 3000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  return { queue, openSlots, scheduledSlots, fetchData };
}