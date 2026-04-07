import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useDispatchData() {
  const [queue, setQueue] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState([]);

  const runAutomatedSweeper = async () => {
    const now = new Date().getTime();

    // 1. Clear 25-minute stale queue entries
    const twentyFiveMinsAgo = new Date(now - 25 * 60000).toISOString();
    const { data: expiredQ } = await supabase.from('queue_entries').select('*').lt('entered_at', twentyFiveMinsAgo);
    if (expiredQ?.length > 0) {
      const icIds = expiredQ.map(q => q.ic_id);
      await supabase.from('queue_entries').delete().in('id', expiredQ.map(q => q.id));
      await supabase.from('profiles').update({ current_status: 'AVAILABLE' }).in('id', icIds);
    }

    // 2. Clear 30-MINUTE missed assignments (Pending Timeout)
    const thirtyMinsAgo = new Date(now - 30 * 60000).toISOString();
    const { data: expiredS } = await supabase.from('bps_slots').select('*').eq('status', 'ASSIGNED').lt('assigned_at', thirtyMinsAgo);
    if (expiredS?.length > 0) {
      const slotIds = expiredS.map(s => s.id);
      const icIds = expiredS.map(s => s.assigned_ic_id).filter(Boolean);
      await supabase.from('bps_slots').update({ status: 'OPEN', assigned_ic_id: null, assigned_at: null }).in('id', slotIds);
      if (icIds.length > 0) await supabase.from('profiles').update({ current_status: 'AVAILABLE' }).in('id', icIds);
    }

    // 3. Midnight PST Cleanup (Deletes old unused OPEN slots)
    const getPSTMidnightISO = () => {
      const d = new Date();
      const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
      const pst = new Date(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      pst.setHours(0, 0, 0, 0);
      return new Date(pst.getTime() + (utc.getTime() - pst.getTime())).toISOString();
    };
    
    const pstMidnight = getPSTMidnightISO();
    const { data: staleSlots } = await supabase.from('bps_slots').select('id').eq('status', 'OPEN').lt('start_time', pstMidnight);
    if (staleSlots?.length > 0) await supabase.from('bps_slots').delete().in('id', staleSlots.map(s => s.id));
  };

  const fetchData = useCallback(async () => {
    try {
      // Fetch Queue
      const { data: qData } = await supabase.from('queue_entries').select('*, profiles(email, tier_rank, current_status)').order('entered_at');
      if (qData) {
        // Optimistically hide ICs that are marked BUSY to prevent UI lag
        const activeQueue = qData.filter(q => q.profiles?.current_status !== 'BUSY');
        setQueue(activeQueue.sort((a, b) => (a.profiles?.tier_rank || 3) - (b.profiles?.tier_rank || 3) || new Date(a.entered_at) - new Date(b.entered_at)));
      }

      // We completely removed the strict date boundaries here. 
      // If a slot is OPEN, ASSIGNED, or CONFIRMED, it belongs on the board until the midnight sweeper kills it.
      // This permanently stops slots from mysteriously disappearing.
      const { data: oSlots } = await supabase.from('bps_slots').select('*').eq('status', 'OPEN').order('start_time');
      if (oSlots) setOpenSlots(oSlots);

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