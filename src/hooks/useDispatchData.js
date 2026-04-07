import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useDispatchData Hook
 *
 * Manages real-time dispatch data including queue entries, open slots, and scheduled slots.
 * Implements the automated sweeper to clear stale entries and perform Midnight PST cleanup.
 */
export function useDispatchData() {
  const [queue, setQueue] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState([]);

  const runAutomatedSweeper = async () => {
    const now = new Date().getTime();

    // Sweep 1: Clear 25-minute stale queue entries
    const twentyFiveMinsAgo = new Date(now - 25 * 60000).toISOString();
    const { data: expiredQ } = await supabase
      .from('queue_entries')
      .select('*')
      .lt('entered_at', twentyFiveMinsAgo);

    if (expiredQ && expiredQ.length > 0) {
      const icIds = expiredQ.map(q => q.ic_id);
      await supabase.from('queue_entries').delete().in('id', expiredQ.map(q => q.id));
      await supabase.from('profiles').update({ current_status: 'AVAILABLE' }).in('id', icIds);
    }

    // Sweep 2: Clear 5-minute missed assignments
    const fiveMinsAgo = new Date(now - 5 * 60000).toISOString();
    const { data: expiredS } = await supabase
      .from('bps_slots')
      .select('*')
      .eq('status', 'ASSIGNED')
      .lt('assigned_at', fiveMinsAgo);

    if (expiredS && expiredS.length > 0) {
      const slotIds = expiredS.map(s => s.id);
      const icIds = expiredS.map(s => s.assigned_ic_id).filter(Boolean);
      await supabase
        .from('bps_slots')
        .update({ status: 'OPEN', assigned_ic_id: null, assigned_at: null })
        .in('id', slotIds);
      if (icIds.length > 0) {
        await supabase.from('profiles').update({ current_status: 'AVAILABLE' }).in('id', icIds);
      }
    }

    // Sweep 3: Midnight PST Cleanup
    // Calculates exact Midnight PST relative to UTC to delete yesterday's unassigned OPEN slots
    const getPSTMidnightISO = () => {
      const date = new Date();
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const offset = utcDate.getTime() - tzDate.getTime();
      
      tzDate.setHours(0, 0, 0, 0); // Set to midnight local PST
      return new Date(tzDate.getTime() + offset).toISOString();
    };

    const pstMidnight = getPSTMidnightISO();
    
    const { data: staleSlots } = await supabase
      .from('bps_slots')
      .select('id')
      .eq('status', 'OPEN')
      .lt('start_time', pstMidnight);

    if (staleSlots && staleSlots.length > 0) {
      await supabase.from('bps_slots').delete().in('id', staleSlots.map(s => s.id));
    }
  };

  const fetchData = async () => {
    // Fetch queue with profile data
    const { data: qData } = await supabase
      .from('queue_entries')
      .select('*, profiles(email, tier_rank)')
      .order('entered_at');

    if (qData) {
      setQueue(
        qData.sort((a, b) => {
          const tA = a.profiles?.tier_rank || 3;
          const tB = b.profiles?.tier_rank || 3;
          if (tA !== tB) return tA - tB;
          return new Date(a.entered_at) - new Date(b.entered_at);
        })
      );
    }

    // Fetch today's open slots
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const { data: oSlots } = await supabase
      .from('bps_slots')
      .select('*')
      .eq('status', 'OPEN')
      .gte('start_time', startOfToday.toISOString())
      .lte('start_time', endOfToday.toISOString())
      .order('start_time');

    if (oSlots) setOpenSlots(oSlots);

    // Fetch today's scheduled slots
    const { data: sSlots } = await supabase
      .from('bps_slots')
      .select('*, profiles(email)')
      .in('status', ['ASSIGNED', 'CONFIRMED'])
      .gte('start_time', startOfToday.toISOString())
      .lte('start_time', endOfToday.toISOString())
      .order('start_time');

    if (sSlots) setScheduledSlots(sSlots);
  };

  useEffect(() => {
    fetchData();

    // Run every 30 seconds: fetch data + run sweeper
    const interval = setInterval(() => {
      fetchData();
      runAutomatedSweeper();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    queue,
    openSlots,
    scheduledSlots,
    fetchData
  };
}