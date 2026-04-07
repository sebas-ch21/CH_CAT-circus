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

    // 2. Clear 5-MINUTE missed assignments (Pending Timeout)
    const fiveMinsAgo = new Date(now - 5 * 60000).toISOString();
    const { data: expiredS } = await supabase.from('bps_slots').select('*').eq('status', 'ASSIGNED').lt('assigned_at', fiveMinsAgo);
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
      const { data: qData, error: qError } = await supabase.from('queue_entries').select('*, profiles(email, tier_rank, current_status)').order('entered_at');
      if (qError) console.error("Queue Fetch Error:", qError);
      if (qData) {
        // Optimistically hide ICs that are marked BUSY to prevent UI lag
        const activeQueue = qData.filter(q => q.profiles?.current_status !== 'BUSY');
        setQueue(activeQueue.sort((a, b) => (a.profiles?.tier_rank || 3) - (b.profiles?.tier_rank || 3) || new Date(a.entered_at) - new Date(b.entered_at)));
      }

      // FIX: Wide UTC boundary to ensure timezone shifts don't hide today's slots
      const startOfToday = new Date(); startOfToday.setHours(-12, 0, 0, 0); 
      const endOfToday = new Date(); endOfToday.setHours(36, 59, 59, 999);

      // Fetch Open Slots
      const { data: oSlots, error: oError } = await supabase.from('bps_slots').select('*').eq('status', 'OPEN').gte('start_time', startOfToday.toISOString()).lte('start_time', endOfToday.toISOString()).order('start_time');
      if (oError) console.error("Open Slots Error:", oError);
      if (oSlots) setOpenSlots(oSlots);

      // Fetch Scheduled Slots
      const { data: sSlots, error: sError } = await supabase.from('bps_slots').select('*, profiles(email)').in('status', ['ASSIGNED', 'CONFIRMED']).gte('start_time', startOfToday.toISOString()).lte('start_time', endOfToday.toISOString()).order('start_time');
      if (sError) console.error("Scheduled Slots Error:", sError);
      if (sSlots) setScheduledSlots(sSlots);
    } catch (err) {
      console.error('FetchData Exception:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Rapid polling to ensure manager and IC screens sync instantly
    const interval = setInterval(() => { fetchData(); runAutomatedSweeper(); }, 4000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  return { queue, openSlots, scheduledSlots, fetchData };
}