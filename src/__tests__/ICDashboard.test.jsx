import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ICDashboard } from '../pages/ICDashboard';
import { AuthContext } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

const mockState = {
  queueData: [],
  slotData: [],
  profileData: [{ id: '123', tier_rank: 3 }]
};

vi.mock('../lib/supabase', () => {
  const mockFrom = vi.fn((table) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      insert: vi.fn(async () => ({ error: null })),
      delete: vi.fn(async () => ({ error: null })),
      update: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => {
        if (table === 'profiles') return { data: mockState.profileData[0], error: null };
        return { data: null, error: null };
      }),
      then: vi.fn(async (resolve) => {
        if (table === 'queue_entries') return resolve({ data: mockState.queueData, error: null });
        if (table === 'bps_slots') return resolve({ data: mockState.slotData, error: null });
        if (table === 'profiles') return resolve({ data: mockState.profileData, error: null });
        return resolve({ data: [], error: null });
      })
    };
    return chain;
  });

  const mockChannel = {
    on: vi.fn(() => mockChannel),
    subscribe: vi.fn(() => mockChannel),
    unsubscribe: vi.fn(),
  };

  return {
    supabase: {
      from: mockFrom,
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn(),
    }
  };
});

const mockUser = { id: '123', email: 'ic1@clinic.com', role: 'IC' };

describe('IC Dashboard Automated Tests', () => {

  const renderDashboard = () => render(
    <BrowserRouter>
      <AuthContext.Provider value={{ user: mockUser, logout: vi.fn() }}>
        <ICDashboard />
      </AuthContext.Provider>
    </BrowserRouter>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.queueData = [];
    mockState.slotData = [];
  });

  it('renders the initial available state', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Enter Reassignment Queue/i)).toBeInTheDocument();
    });
  });

  it('enter queue button is clickable', async () => {
    renderDashboard();
    const enterButton = await screen.findByText(/Enter Reassignment Queue/i);
    expect(enterButton).toBeInTheDocument();
    expect(enterButton).not.toBeDisabled();
    fireEvent.click(enterButton);
  });

  it('renders available when not in queue', async () => {
    mockState.queueData = [];
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Enter Reassignment Queue/i)).toBeInTheDocument();
    });
  });
});
