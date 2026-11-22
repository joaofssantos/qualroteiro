import { AuthActions } from '@/core/auth/AuthProvider';

export function AuthSlot({ compact = false }: { compact?: boolean }) {
  return <AuthActions compact={compact} />;
}
