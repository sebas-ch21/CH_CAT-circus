import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useDispatchData() {
  const [queue, setQueue] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState([]);

  const fetchData = useCallback(async () => {
    // 1. TRIGGER SAFE BACKEND CLEANUP (Non-blocking)
    supabase.rpc('cleanup_stale_data').catch(err => console.error("Cleanup RPC Error:", err));

    // 2. FETCH PROFILES (For safe in-memory mapping)
    let profileMap = {};
    try {
      const { data: allProfiles } = await supabase.from('profiles').select('*');
      if (allProfiles) {
        allProfiles.forEach(p => { profileMap[p.id] = p; });
      }
    } catch (err) {
      console.warn("Profiles fetch warning:", err);
    }

    // 3. FETCH OPEN SLOTS (Isolated)
    try {
      const { data: oSlots } = await supabase.from('bps_slots').select('*').eq('status', 'OPEN').order('start_time');
      if (oSlots) setOpenSlots(oSlots);
    } catch (err) {
      console.error("Open Slots fetch error:", err);
    }

    // 4. FETCH SCHEDULED SLOTS (Isolated & safely mapped)
    try {
      const { data: sSlots } = await supabase.from('bps_slots').select('*').in('status', ['ASSIGNED', 'CONFIRMED']).order('start_time');
      if (sSlots) {
        const mappedSlots = sSlots.map(slot => ({
          ...slot,
          ic_email: profileMap[slot.assigned_ic_id]?.email || 'Unknown Staff',
          profiles: profileMap[slot.assigned_ic_id] || {} 
        }));
        setScheduledSlots(mappedSlots);
      }
    } catch (err) {
      console.error("Scheduled Slots fetch error:", err);
    }

    // 5. FETCH QUEUE (Isolated & safely mapped)
    try {
      const { data: qData } = await supabase.from('queue_entries').select('*').order('entered_at');
      if (qData) {
        const enrichedQueue = qData.map(q => ({
          ...q,
          // Fallback ensures ICs don't vanish if there's a weird data sync issue
          profiles: profileMap[q.ic_id] || { current_status: 'IN_QUEUE', tier_rank: 3, email: 'Unknown' }
        }));
        
        // Strict State: Only show users actively waiting
        const activeQueue = enrichedQueue.filter(q => q.profiles.current_status === 'IN_QUEUE');
        setQueue(activeQueue.sort((a, b) => (a.profiles.tier_rank || 3) - (b.profiles.tier_rank || 3) || new Date(a.entered_at) - new Date(b.entered_at)));
      }
    } catch (err) {
      console.error("Queue fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Smooth, read-only polling every 3 seconds.
    const interval = setInterval(() => { fetchData(); }, 3000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  return { queue, openSlots, scheduledSlots, fetchData };
}