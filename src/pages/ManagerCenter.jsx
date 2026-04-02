import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TopNav } from '../components/TopNav';
import { Clock, User, Calendar, CircleCheck, CheckCircle2, AlertCircle, X, Loader } from 'lucide-react';

export function ManagerCenter() {
  const [activeTab, setActiveTab] = useState('dispatch'); 
  const [queue, setQueue] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState([]);
  
  const [selectedIC, setSelectedIC] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  
  // Confirmation & Loading States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  
  const [timeZone, setTimeZone] = useState('America/Denver'); 

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    const { data: qData } = await supabase.from('queue_entries').select('*, profiles(email, tier_rank)').order('entered_at');
    if (qData) {
      const sorted = qData.sort((a, b) => {
        const tA = a.profiles?.tier_rank || 3;
        const tB = b.profiles?.tier_rank || 3;
        if (tA !== tB) return tA - tB;
        return new Date(a.entered_at) - new Date(b.entered_at);
      });
      setQueue(sorted);
    }

    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    const endOfToday = new Date();
    endOfToday.setHours(23,59,59,999);

    const { data: oSlots } = await supabase
      .from('bps_slots')
      .select('*')
      .eq('status', 'OPEN')
      .gte('start_time', startOfToday.toISOString())
      .lte('start_time', endOfToday.toISOString())
      .order('start_time');
    if (oSlots) setOpenSlots(oSlots);

    const { data: sSlots } = await supabase
      .from('bps_slots')
      .select('*, profiles(email)')
      .eq('status', 'ASSIGNED')
      .gte('start_time', startOfToday.toISOString())
      .lte('start_time', endOfToday.toISOString())
      .order('start_time');
    if (sSlots) setScheduledSlots(sSlots);
  };

  const executeDispatch = async () => {
    if (!selectedIC || !selectedSlot) return;
    setDispatching(true);
    
    try {
      await supabase.from('bps_slots').update({
        status: 'ASSIGNED',
        assigned_ic_id: selectedIC.ic_id
      }).eq('id', selectedSlot.id);

      await supabase.from('profiles').update({ current_status: 'BUSY' }).eq('id', selectedIC.ic_id);
      await supabase.from('queue_entries').delete().eq('id', selectedIC.id);

      setSelectedIC(null);
      setSelectedSlot(null);
      setShowConfirmModal(false);
      fetchData();
    } catch (error) {
      console.error("Dispatch Error:", error);
    } finally {
      setDispatching(false);
    }
  };

  // Explicitly calculate and format both the BPS Time and the Overflow Time
  const getDualTimes = (isoString) => {
    const ofDate = new Date(isoString);
    // The BPS start time is exactly 15 minutes prior to the Overflow time
    const bpsDate = new Date(ofDate.getTime() - 15 * 60000);
    
    return {
      bps: bpsDate.toLocaleTimeString('en-US', { timeZone: timeZone, hour: 'numeric', minute: '2-digit' }),
      of: ofDate.toLocaleTimeString('en-US', { timeZone: timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      
      <div className="max-w-7xl mx-auto px-6 py-6 w-full flex-1 flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#0F172A]">Manager Center</h1>
            <p className="text-gray-500 mt-1">Live dispatch routing and daily schedule overview.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-1 flex font-bold text-sm shadow-sm">
              <button 
                onClick={() => setTimeZone('America/Denver')}
                className={`px-4 py-1.5 rounded-md transition-all ${timeZone === 'America/Denver' ? 'bg-[#0F172A] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                MT (Mountain)
              </button>
              <button 
                onClick={() => setTimeZone('America/Chicago')}
                className={`px-4 py-1.5 rounded-md transition-all ${timeZone === 'America/Chicago' ? 'bg-[#0F172A] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                CT (Central)
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 border-b border-gray-200 mb-6">
          <button 
            onClick={() => setActiveTab('dispatch')}
            className={`px-6 py-3 font-bold text-sm transition-all border-b-4 ${activeTab === 'dispatch' ? 'border-[#5E4791] text-[#5E4791]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Live Dispatch Board
          </button>
          <button 
            onClick={() => setActiveTab('scheduled')}
            className={`px-6 py-3 font-bold text-sm transition-all border-b-4 ${activeTab === 'scheduled' ? 'border-[#5E4791] text-[#5E4791]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Scheduled Matches
          </button>
        </div>

        {/* TAB 1: LIVE DISPATCH */}
        {activeTab === 'dispatch' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
            
            {/* Waiting Queue */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col h-[700px]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><User className="w-5 h-5 text-[#5E4791]" /> Waiting Queue</h2>
                <span className="bg-[#F3EFF9] text-[#5E4791] px-2.5 py-0.5 rounded-full text-xs font-bold">{queue.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {queue.map(entry => (
                  <button key={entry.id} onClick={() => setSelectedIC(entry)} className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedIC?.id === entry.id ? 'border-[#5E4791] bg-purple-50 shadow-sm' : 'border-gray-100 hover:border-gray-300 bg-gray-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-[#0F172A] truncate pr-2">{entry.profiles?.email?.split('@')[0]}</span>
                      <span className="bg-[#E0F5F6] text-[#007C8C] text-xs font-bold px-2 py-1 rounded">Tier {entry.profiles?.tier_rank}</span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Wait: {Math.round((new Date() - new Date(entry.entered_at)) / 60000)} mins
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Open Slots */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col h-[700px]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-[#007C8C]" /> Open Slots</h2>
                <span className="bg-[#E0F5F6] text-[#007C8C] px-2.5 py-0.5 rounded-full text-xs font-bold">{openSlots.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {openSlots.map(slot => {
                  const times = getDualTimes(slot.start_time);
                  return (
                    <button key={slot.id} onClick={() => setSelectedSlot(slot)} className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedSlot?.id === slot.id ? 'border-[#007C8C] bg-[#E0F5F6] shadow-sm' : 'border-gray-100 hover:border-gray-300 bg-white shadow-sm'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-lg text-[#0F172A]">{slot.patient_identifier}</div>
                        {slot.host_manager && <span className="text-[#007C8C] font-semibold text-[10px] uppercase tracking-wider bg-[#E0F5F6] px-2 py-1 rounded-md">Host: {slot.host_manager.split('@')[0]}</span>}
                      </div>
                      <div className="flex flex-col gap-1.5 mt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-bold">BPS Start:</span>
                          <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{times.bps}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#5E4791] font-bold">Overflow Time:</span>
                          <span className="font-bold text-[#5E4791] bg-purple-50 border border-purple-100 px-2 py-0.5 rounded">{times.of}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dispatch Action Panel */}
            <div className="bg-[#0F172A] rounded-2xl p-6 shadow-xl text-white flex flex-col h-[700px] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
              
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 relative z-10"><CircleCheck className="w-5 h-5 text-[#007C8C]" /> Match & Dispatch</h2>
              
              <div className="space-y-6 flex-1 relative z-10">
                <div className="bg-white/10 p-5 rounded-xl border border-white/20 backdrop-blur-sm">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2"><User className="w-3 h-3"/> Selected Staff (IC)</p>
                  {selectedIC ? <p className="font-bold text-lg text-white">{selectedIC.profiles.email}</p> : <p className="text-gray-500 italic font-medium">Waiting for selection...</p>}
                </div>
                
                <div className="bg-white/10 p-5 rounded-xl border border-white/20 backdrop-blur-sm">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2"><Calendar className="w-3 h-3"/> Selected Room (Slot)</p>
                  {selectedSlot ? (
                    <div>
                      <p className="font-bold text-lg text-white mb-3">{selectedSlot.patient_identifier}</p>
                      <div className="bg-black/20 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">BPS Time:</span>
                          <span className="font-semibold text-gray-200">{getDualTimes(selectedSlot.start_time).bps}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-purple-300 font-bold">OF Time:</span>
                          <span className="font-bold text-purple-200">{getDualTimes(selectedSlot.start_time).of}</span>
                        </div>
                      </div>
                    </div>
                  ) : <p className="text-gray-500 italic font-medium">Waiting for selection...</p>}
                </div>
              </div>

              <button 
                onClick={() => setShowConfirmModal(true)}
                disabled={!selectedIC || !selectedSlot}
                className="w-full mt-auto py-5 rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-400 bg-white text-[#0F172A] hover:bg-gray-100 shadow-[0_0_20px_rgba(255,255,255,0.1)] relative z-10"
              >
                Initiate Dispatch
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SCHEDULED MATCHES */}
        {activeTab === 'scheduled' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex-1">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" /> Today's Confirmed Matches
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">BPS Time</th>
                    <th className="p-4 text-[10px] font-bold text-[#5E4791] uppercase tracking-widest">Overflow Time</th>
                    <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Room ID</th>
                    <th className="p-4 text-[10px] font-bold text-[#007C8C] uppercase tracking-widest">Assigned Staff (IC)</th>
                    <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Overflow Host</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledSlots.length === 0 ? (
                    <tr><td colSpan="5" className="p-12 text-center text-gray-400 font-medium border-2 border-dashed rounded-xl mt-4">No slots scheduled yet today.</td></tr>
                  ) : (
                    scheduledSlots.map(slot => {
                      const times = getDualTimes(slot.start_time);
                      return (
                        <tr key={slot.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-semibold text-gray-600">{times.bps}</td>
                          <td className="p-4 font-bold text-[#5E4791] bg-purple-50/50">{times.of}</td>
                          <td className="p-4 font-bold text-[#0F172A]">{slot.patient_identifier}</td>
                          <td className="p-4 font-semibold text-[#007C8C]">{slot.profiles?.email || 'Unknown'}</td>
                          <td className="p-4 font-semibold text-gray-500">{slot.host_manager || 'Unassigned'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* --- DISPATCH CONFIRMATION MODAL --- */}
      {showConfirmModal && selectedIC && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-[#007C8C]" />
                Confirm Assignment
              </h2>
              <button onClick={() => setShowConfirmModal(false)} disabled={dispatching} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 bg-gray-50/50">
              <p className="text-gray-600 mb-6 text-center">You are about to remove this IC from the queue and assign them to a live room. Please verify the details below.</p>
              
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Staff Member</span>
                  <span className="font-bold text-[#007C8C] text-lg">{selectedIC.profiles.email.split('@')[0]}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Room ID</span>
                  <span className="font-bold text-[#0F172A] text-lg">{selectedSlot.patient_identifier}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Overflow Time</span>
                  <span className="font-bold text-[#5E4791] text-lg bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">{getDualTimes(selectedSlot.start_time).of}</span>
                </div>
              </div>
            </div>

            <div className="p-6 flex gap-3 bg-white border-t border-gray-100">
              <button 
                onClick={() => setShowConfirmModal(false)}
                disabled={dispatching}
                className="flex-1 py-4 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDispatch}
                disabled={dispatching}
                style={{ backgroundColor: '#0F172A', color: '#ffffff' }}
                className="flex-1 py-4 rounded-xl font-bold shadow-md hover:opacity-90 transition-opacity flex justify-center items-center gap-2"
              >
                {dispatching ? <><Loader className="w-5 h-5 animate-spin"/> Routing...</> : 'Yes, Route IC Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}