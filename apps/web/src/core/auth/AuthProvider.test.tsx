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

  it('compact mode keeps the accessible name but shows an icon with a tooltip, ≥ 44 px', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    const { AuthActions, AuthProvider } = await import('./AuthProvider');

    render(
      <AuthProvider>
        <AuthActions compact />
      </AuthProvider>,
    );

    const button = screen.getByRole('button', { name: 'Login indisponível' });
    expect(button).toBeDisabled();
    expect(button.textContent).toBe('');
    expect(button.className).toMatch(/min-h-11/);
    expect(button.className).toMatch(/min-w-11/);
    expect(button.parentElement).toHaveAttribute('title', 'Login indisponível');
  });
});
