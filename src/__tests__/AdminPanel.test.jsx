import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminPanel } from '../pages/AdminPanel';
import { AuthContext } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  }
}));

const mockAdminUser = { id: 'a1', email: 'admin@clinic.com', role: 'ADMIN' };

const renderAdminPanel = () => render(
  <BrowserRouter>
    <AuthContext.Provider value={{ user: mockAdminUser, logout: vi.fn() }}>
      <AdminPanel />
    </AuthContext.Provider>
  </BrowserRouter>
);

describe('Admin Panel Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders the Consolidated Planner by default', async () => {
    renderAdminPanel();
    await waitFor(() => {
      expect(screen.getByText(/Consolidated Circus Planner/i)).toBeInTheDocument();
      expect(screen.getByText(/Publish Overflows/i)).toBeInTheDocument();
    });
  });

  it('2. Switches to Roster Management tab', async () => {
    renderAdminPanel();
    
    const rosterTab = screen.getByText(/Roster Management/i);
    fireEvent.click(rosterTab);

    await waitFor(() => {
      expect(screen.getByText(/Active Team Roster/i)).toBeInTheDocument();
      expect(screen.getByText(/Import Roster CSV/i)).toBeInTheDocument();
    });
  });

  it('3. Can change the Calc % input', async () => {
    renderAdminPanel();
    
    await waitFor(() => {
      expect(screen.getByText(/Consolidated Circus Planner/i)).toBeInTheDocument();
    });

    const calcInput = screen.getByDisplayValue('30'); // Default is 30
    fireEvent.change(calcInput, { target: { value: '45' } });

    expect(calcInput.value).toBe('45');
  });
});