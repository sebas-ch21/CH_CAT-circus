import { useEffect } from 'react';
import { ChartBar as BarChart3 } from 'lucide-react';

/**
 * StatisticsDashboard Component
 *
 * Displays dispatch performance metrics for the last 7 days.
 * Shows total dispatches, breakdowns by tier, and individual IC performance.
 *
 * @param {Object} props
 * @param {Object} props.stats - Statistics object with total, byIC, and byTier
 * @param {Function} props.loadStatistics - Function to load/refresh statistics
 */
export function StatisticsDashboard({ stats, loadStatistics }) {
  useEffect(() => {
    loadStatistics();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h2 className="text-2xl font-black text-[#0F172A] mb-2 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-[#007C8C]" /> Dispatch Statistics (Last 7 Days)
        </h2>
        <p className="text-gray-500 font-medium mb-8">
          Performance metrics based on permanently logged successful dispatches.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#F3EFF9] border border-[#E7DFF3] rounded-2xl p-6 text-center">
            <p className="text-xs font-black text-[#5E4791] uppercase tracking-widest mb-2">
              Total Dispatches
            </p>
            <p className="text-5xl font-black text-[#0F172A]">{stats.total}</p>
          </div>

          <div className="bg-[#E0F5F6] border border-[#C1ECEF] rounded-2xl p-6 text-center">
            <p className="text-xs font-black text-[#007C8C] uppercase tracking-widest mb-2">
              Tier 1 Dispatches
            </p>
            <p className="text-5xl font-black text-[#0F172A]">{stats.byTier[1] || 0}</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
              Tier 2/3 Dispatches
            </p>
            <p className="text-5xl font-black text-[#0F172A]">
              {(stats.byTier[2] || 0) + (stats.byTier[3] || 0)}
            </p>
          </div>
        </div>

        <h3 className="text-lg font-black text-[#0F172A] mb-4">Total Dispatches per IC</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(stats.byIC)
            .sort((a, b) => b[1] - a[1])
            .map(([email, count]) => (
              <div
                key={email}
                className="flex justify-between items-center p-4 border-2 border-gray-100 rounded-xl bg-gray-50"
              >
                <span className="font-bold text-gray-700 truncate pr-4">
                  {email.split('@')[0]}
                </span>
                <span className="bg-[#0F172A] text-white px-3 py-1 rounded-lg font-black">
                  {count}
                </span>
              </div>
            ))}
          {Object.keys(stats.byIC).length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-400 font-medium border-2 border-dashed rounded-xl">
              No logs found for the last 7 days.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
