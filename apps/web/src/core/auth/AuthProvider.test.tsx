import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('AuthProvider without Clerk configuration', () => {
  it('keeps children rendering with missingAuth and disables login actions', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    const { AuthActions, AuthProvider } = await import('./AuthProvider');
    const { useQualAuth } = await import('./AuthContext');

    function Probe() {
      const auth = useQualAuth();
      return <span data-testid="configured">{String(auth.isConfigured)}</span>;
    }

    render(
      <AuthProvider>
        <Probe />
        <AuthActions />
      </AuthProvider>,
    );

    expect(screen.getByTestId('configured')).toHaveTextContent('false');
    expect(screen.getByRole('button', { name: 'Login indisponível' })).toBeDisabled();
  });
});
