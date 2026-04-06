import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManagerCenter } from '../pages/ManagerCenter';
import { AuthContext } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Deep mock for Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  }
}));

const mockManagerUser = { id: 'm1', email: 'manager@clinic.com', role: 'MANAGER' };

const renderManagerCenter = () => render(
  <BrowserRouter>
    <AuthContext.Provider value={{ user: mockManagerUser, logout: vi.fn() }}>
      <ManagerCenter />
    </AuthContext.Provider>
  </BrowserRouter>
);

describe('Manager Center Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers(); // Prevents the 30-second interval from hanging the tests
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. Renders the Live Dispatch board by default', async () => {
    renderManagerCenter();
    await waitFor(() => {
      expect(screen.getByText(/Waiting Queue/i)).toBeInTheDocument();
      expect(screen.getByText(/Execute Match/i)).toBeInTheDocument();
    });
  });

  it('2. Switches to My Team Schedule tab', async () => {
    renderManagerCenter();
    
    const teamTab = screen.getByText(/My Team Schedule/i);
    fireEvent.click(teamTab);

    await waitFor(() => {
      // Verifies the save button and the interval labels loaded
      expect(screen.getByText(/Save Team Schedule/i) || screen.getByText(/Save/i)).toBeInTheDocument();
      expect(screen.getByText(/07:00 AM MT/i)).toBeInTheDocument();
    });
  });

  it('3. Switches to Statistics tab', async () => {
    renderManagerCenter();
    
    const statsTab = screen.getByText(/Dispatch Statistics/i);
    fireEvent.click(statsTab);

    await waitFor(() => {
      expect(screen.getByText(/Total Dispatches per IC/i)).toBeInTheDocument();
    });
  });
});