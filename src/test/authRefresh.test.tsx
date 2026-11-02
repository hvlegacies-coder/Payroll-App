import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Simulate a page refresh: the saved session and the role query both resolve
// after the first render. The guard must wait instead of bouncing to /login.
let savedSession: unknown = null;
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: () => new Promise(r => setTimeout(() => r({ data: { session: savedSession } }), 20)),
    },
    from: () => ({ select: () => ({ eq: () => new Promise(r => setTimeout(() => r({ data: [{ role: 'admin' }] }), 20)) }) }),
  },
}));

import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const app = () => render(
  <AuthProvider>
    <MemoryRouter initialEntries={['/upload']}>
      <Routes>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route path="/upload" element={<ProtectedRoute><div>UPLOAD PAGE</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  </AuthProvider>,
);

describe('refresh keeps you signed in', () => {
  it('signed-in admin stays on the page', async () => {
    savedSession = { user: { id: 'u1' } };
    app();
    expect(screen.queryByText('LOGIN PAGE')).toBeNull();
    expect(await screen.findByText('UPLOAD PAGE')).toBeTruthy();
    expect(screen.queryByText('LOGIN PAGE')).toBeNull();
  });

  it('signed-out user still goes to login', async () => {
    savedSession = null;
    app();
    expect(await screen.findByText('LOGIN PAGE')).toBeTruthy();
  });
});
