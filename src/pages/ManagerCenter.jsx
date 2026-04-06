import { useState } from 'react';
import { TopNav } from '../components/TopNav';
import { useAuth } from '../context/AuthContext';
import { useDispatchData } from '../hooks/useDispatchData';
import { useManagerStats } from '../hooks/useManagerStats';
import { WaitingQueue } from '../components/manager/WaitingQueue';
import { OpenSlots } from '../components/manager/OpenSlots';
import { DispatchActionPanel } from '../components/manager/DispatchActionPanel';
import { ZoomLinkModal } from '../components/manager/ZoomLinkModal';
import { ScheduledMatchesTable } from '../components/manager/ScheduledMatchesTable';
import { TeamScheduleInput } from '../components/manager/TeamScheduleInput';
import { StatisticsDashboard } from '../components/manager/StatisticsDashboard';
import { Clock, CircleCheck as CheckCircle2, ChartBar as BarChart3, Users } from 'lucide-react';

/**
 * ManagerCenter Page
 *
 * Enterprise-grade manager interface for live dispatching, team scheduling, and performance tracking.
 * Implements clean separation of concerns with custom hooks and modular components.
 *
 * Architecture:
 * - useDispatchData: Handles queue, slots, and automated sweeper (25min queue, 5min assignments)
 * - useManagerStats: Aggregates dispatch performance metrics
 * - Component-based UI: WaitingQueue, OpenSlots, DispatchActionPanel, etc.
 */
export function ManagerCenter() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dispatch');
  const [timeZone, setTimeZone] = useState('America/Denver');

  // Dispatch hook with automated sweeper
  const { queue, openSlots, scheduledSlots, fetchData } = useDispatchData();

  // Statistics hook
  const { stats, loadStatistics } = useManagerStats();

  // Selection state
  const [selectedIC, setSelectedIC] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Modal state
  const [editingSlot, setEditingSlot] = useState(null);

  /**
   * Formats times for BPS and OF display with timezone support
   *
   * @param {string} isoString - ISO timestamp from database
   * @param {string} tz - Timezone identifier
   * @returns {Object} Object with bps and of time strings
   */
  const getDualTimes = (isoString, tz) => {
    const ofDate = new Date(isoString);
    const bpsDate = new Date(ofDate.getTime() - 15 * 60000);
    return {
      bps: bpsDate.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: '2-digit'
      }),
      of: ofDate.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    };
  };

  const handleDispatchComplete = () => {
    setSelectedIC(null);
    setSelectedSlot(null);
    fetchData();
  };

  const handleZoomLinkSave = () => {
    setEditingSlot(null);
    fetchData();
  };

  const getTabClass = id =>
    `px-6 py-4 font-bold text-sm transition-all border-b-4 focus:outline-none ${
      activeTab === id
        ? 'border-[#5E4791] text-[#0F172A] bg-white'
        : 'border-transparent text-gray-500 hover:text-gray-900 bg-gray-50'
    }`;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-20">
      <TopNav />

      <div className="max-w-[1400px] mx-auto px-6 py-8 w-full flex-1 flex flex-col">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-3xl font-black text-[#0F172A]">Manager Center</h1>
            <p className="text-gray-500 mt-1 font-medium">
              Live dispatching, team schedules, and performance tracking.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-1 flex font-bold text-sm shadow-sm">
            <button
              onClick={() => setTimeZone('America/Denver')}
              className={`px-5 py-2 rounded-lg transition-all ${
                timeZone === 'America/Denver'
                  ? 'bg-[#0F172A] text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              MT
            </button>
            <button
              onClick={() => setTimeZone('America/Chicago')}
              className={`px-5 py-2 rounded-lg transition-all ${
                timeZone === 'America/Chicago'
                  ? 'bg-[#0F172A] text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              CT
            </button>
          </div>
        </div>

        <div className="flex rounded-t-2xl border border-gray-200 overflow-hidden shadow-sm mb-6">
          <button onClick={() => setActiveTab('dispatch')} className={getTabClass('dispatch')}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> Live Dispatch Board
            </div>
          </button>
          <button onClick={() => setActiveTab('scheduled')} className={getTabClass('scheduled')}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Scheduled Matches
            </div>
          </button>
          <button onClick={() => setActiveTab('team')} className={getTabClass('team')}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" /> My Team Schedule
            </div>
          </button>
          <button onClick={() => setActiveTab('stats')} className={getTabClass('stats')}>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Dispatch Statistics
            </div>
          </button>
        </div>

        {activeTab === 'dispatch' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1">
            <WaitingQueue queue={queue} selectedIC={selectedIC} onSelectIC={setSelectedIC} />

            <OpenSlots
              openSlots={openSlots}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              onEditSlot={setEditingSlot}
              getDualTimes={getDualTimes}
              timeZone={timeZone}
            />

            <DispatchActionPanel
              selectedIC={selectedIC}
              selectedSlot={selectedSlot}
              onDispatchComplete={handleDispatchComplete}
              getDualTimes={getDualTimes}
              timeZone={timeZone}
            />
          </div>
        )}

        {activeTab === 'scheduled' && (
          <ScheduledMatchesTable
            scheduledSlots={scheduledSlots}
            getDualTimes={getDualTimes}
            timeZone={timeZone}
          />
        )}

        {activeTab === 'team' && <TeamScheduleInput userEmail={user?.email} />}

        {activeTab === 'stats' && (
          <StatisticsDashboard stats={stats} loadStatistics={loadStatistics} />
        )}
      </div>

      {editingSlot && (
        <ZoomLinkModal
          slot={editingSlot}
          onClose={() => setEditingSlot(null)}
          onSave={handleZoomLinkSave}
        />
      )}
    </div>
  );
}
