import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, type AuthUserInfo } from '../stores/authStore';

const mockUser: AuthUserInfo = {
  id: 'aaaaaaaa-1111-2222-3333-444444444444',
  email: 'erick@sunsetservicesus.com',
  first_name: 'Erick',
  last_name: 'Sunset',
  tenant_id: 'bbbbbbbb-1111-2222-3333-444444444444',
  roles: [{ role: 'owner', division_id: null }],
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('should start with null auth state', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('should set auth on login', () => {
    useAuthStore.getState().setAuth('test-token-123', mockUser);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('test-token-123');
    expect(state.user).toEqual(mockUser);
  });

  it('should clear auth on logout', () => {
    useAuthStore.getState().setAuth('test-token-123', mockUser);
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('should update auth with new token', () => {
    useAuthStore.getState().setAuth('token-1', mockUser);
    useAuthStore.getState().setAuth('token-2', mockUser);

    expect(useAuthStore.getState().accessToken).toBe('token-2');
  });

  it('should update user data', () => {
    useAuthStore.getState().setAuth('token-1', mockUser);

    const updatedUser = { ...mockUser, first_name: 'NewName' };
    useAuthStore.getState().setAuth('token-2', updatedUser);

    expect(useAuthStore.getState().user?.first_name).toBe('NewName');
  });
});
