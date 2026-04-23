import { useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useManagerStats Hook
 *
 * Fetches and processes dispatch statistics from the dispatch_logs table.
 * Provides breakdown by IC email and tier rank for the last 7 days.
 *
 * @returns {Object} Statistics data
 * @property {Object} stats - Contains total, byIC, and byTier breakdowns
 * @property {Function} loadStatistics - Manual trigger to refresh stats
 */
export function useManagerStats() {
  const [stats, setStats] = useState({
    total: 0,
    byIC: {},
    byTier: { 1: 0, 2: 0, 3: 0 }
  });

  /**
   * Loads statistics from dispatch_logs for the last 7 days
   *
   * Aggregates:
   * - Total dispatch count
   * - Dispatch count per IC (by email)
   * - Dispatch count per tier (1, 2, 3)
   */
  const loadStatistics = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: logs } = await supabase
      .from('dispatch_logs')
      .select('*')
      .gte('matched_at', sevenDaysAgo.toISOString());

    if (logs) {
      const byIC = {};
      const byTier = { 1: 0, 2: 0, 3: 0 };

      logs.forEach(log => {
        byIC[log.ic_email] = (byIC[log.ic_email] || 0) + 1;
        byTier[log.tier_rank] = (byTier[log.tier_rank] || 0) + 1;
      });

      setStats({
        total: logs.length,
        byIC,
        byTier
      });
    }
  };

  return {
    stats,
    loadStatistics
  };
}
