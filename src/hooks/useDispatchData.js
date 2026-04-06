import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useDispatchData Hook
 *
 * Manages real-time dispatch data including queue entries, open slots, and scheduled slots.
 * Implements the automated sweeper to clear stale queue entries (25 min) and missed assignments (5 min).
 *
 * Critical Features:
 * - 30-second interval for fetching data and running sweeper
 * - Priority-based queue sorting (tier_rank ascending, then entered_at ascending)
 * - Automated cleanup of expired queue entries and pending confirmations
 *
 * @returns {Object} Dispatch data and fetch function
 * @property {Array} queue - Sorted queue entries with profile data
 * @property {Array} openSlots - Available slots for today
 * @property {Array} scheduledSlots - Assigned/confirmed slots for today
 * @property {Function} fetchData - Manual trigger to refresh all data
 */
export function useDispatchData() {
  const [queue, setQueue] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState([]);

  /**
   * Automated Sweeper - Runs every 30 seconds
   *
   * Sweeps:
   * 1. Queue entries older than 25 minutes -> Delete + Set IC to AVAILABLE
   * 2. Pending confirmations (ASSIGNED status) older than 5 minutes -> Set slot to OPEN + Set IC to AVAILABLE
   *
   * This is critical business logic and must remain exactly as-is.
   */
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
  };

  /**
   * Fetches all dispatch-related data
   *
   * Queue: Sorted by tier_rank (ascending), then entered_at (ascending)
   * Open Slots: Today's slots with status = 'OPEN'
   * Scheduled Slots: Today's slots with status = 'ASSIGNED' or 'CONFIRMED'
   */
  const fetchData = async () => {
    // Fetch queue with profile data
    const { data: qData } = await supabase
      .from('queue_entries')
      .select('*, profiles(email, tier_rank)')
      .order('entered_at');

    if (qData) {
      // Apply priority sorting: Tier 1 first, then by time
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
