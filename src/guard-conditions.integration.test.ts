/**
 * Integration tests for guard-conditions example
 */

import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';
import { and, or, not } from '../src/types';

type AuthContext = {
  username: string;
  password: string;
  loginAttempts: number;
  isLocked: boolean;
  sessionToken: string | null;
};

type AuthEvent =
  | { type: 'ENTER_CREDENTIALS'; username: string; password: string }
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS'; token: string }
  | { type: 'FAILURE' }
  | { type: 'UNLOCK' }
  | { type: 'LOGOUT' };

describe('Guard Conditions Integration (Authentication)', () => {
  function createAuthMachine() {
    const config: StateMachineConfig<AuthContext, AuthEvent> = {
      initial: 'loggedOut',
      debug: false,
      initialContext: {
        username: '',
        password: '',
        loginAttempts: 0,
        isLocked: false,
        sessionToken: null,
      },
      states: {
        loggedOut: {
          on: {
            ENTER_CREDENTIALS: { assign: 'setCredentials' },
            SUBMIT: [
              {
                target: 'locked',
                guard: 'isAccountLocked',
              },
              {
                target: 'authenticating',
                guard: and('hasCredentials', not('isAccountLocked')),
              },
              {
                assign: 'incrementAttempts',
              },
            ],
          },
        },
        authenticating: {
          on: {
            SUCCESS: [
              {
                target: 'loggedIn',
                guard: 'hasValidToken',
                assign: 'setToken',
              },
            ],
            FAILURE: [
              {
                target: 'locked',
                guard: 'tooManyAttempts',
                assign: 'lockAccount',
              },
              {
                target: 'loggedOut',
                assign: 'incrementAttempts',
              },
            ],
          },
        },
        loggedIn: {
          on: {
            LOGOUT: { target: 'loggedOut', assign: 'clearSession' },
          },
        },
        locked: {
          on: {
            UNLOCK: { target: 'loggedOut', assign: 'unlockAccount' },
          },
        },
      },
      guards: {
        hasCredentials: ({ context }) => {
          return context.username.length > 0 && context.password.length > 0;
        },
        isAccountLocked: ({ context }) => {
          return context.isLocked;
        },
        tooManyAttempts: ({ context }) => {
          return context.loginAttempts >= 2; // Lock after 3 attempts
        },
        hasValidToken: ({ event }) => {
          if (event.type !== 'SUCCESS') return false;
          return event.token && event.token.length > 0;
        },
      },
      reducers: {
        setCredentials: ({ event }) => {
          if (event.type !== 'ENTER_CREDENTIALS') return {};
          return {
            username: event.username,
            password: event.password,
          };
        },
        setToken: ({ event }) => {
          if (event.type !== 'SUCCESS') return {};
          return { sessionToken: event.token, loginAttempts: 0 };
        },
        incrementAttempts: ({ context }) => ({
          loginAttempts: context.loginAttempts + 1,
        }),
        lockAccount: ({ context }) => ({
          isLocked: true,
          loginAttempts: context.loginAttempts + 1,
        }),
        unlockAccount: () => ({
          isLocked: false,
          loginAttempts: 0,
          username: '',
          password: '',
        }),
        clearSession: () => ({
          sessionToken: null,
          username: '',
          password: '',
          loginAttempts: 0,
        }),
      },
    };

    return new StateMachine(config);
  }

  it('should initialize to loggedOut state', () => {
    const machine = createAuthMachine();

    expect(machine.getConfiguration().has('loggedOut')).toBe(true);
    expect(machine.getContext().loginAttempts).toBe(0);
    expect(machine.getContext().isLocked).toBe(false);
  });

  it('should not transition without credentials', () => {
    const machine = createAuthMachine();

    machine.send({ type: 'SUBMIT' });

    expect(machine.getConfiguration().has('loggedOut')).toBe(true);
    expect(machine.getContext().loginAttempts).toBe(1);
  });

  it('should transition to authenticating with valid credentials', () => {
    const machine = createAuthMachine();

    machine.send({ type: 'ENTER_CREDENTIALS', username: 'alice', password: 'secret' });
    machine.send({ type: 'SUBMIT' });

    expect(machine.getConfiguration().has('authenticating')).toBe(true);
  });

  it('should complete successful login', () => {
    const machine = createAuthMachine();

    machine.send({ type: 'ENTER_CREDENTIALS', username: 'alice', password: 'secret' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'SUCCESS', token: 'abc123' });

    expect(machine.getConfiguration().has('loggedIn')).toBe(true);
    expect(machine.getContext().sessionToken).toBe('abc123');
    expect(machine.getContext().loginAttempts).toBe(0);
  });

  it('should logout from loggedIn state', () => {
    const machine = createAuthMachine();

    machine.send({ type: 'ENTER_CREDENTIALS', username: 'alice', password: 'secret' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'SUCCESS', token: 'abc123' });
    machine.send({ type: 'LOGOUT' });

    expect(machine.getConfiguration().has('loggedOut')).toBe(true);
    expect(machine.getContext().sessionToken).toBeNull();
    expect(machine.getContext().username).toBe('');
  });

  it('should increment login attempts on failure', () => {
    const machine = createAuthMachine();

    machine.send({ type: 'ENTER_CREDENTIALS', username: 'alice', password: 'wrong' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });

    expect(machine.getConfiguration().has('loggedOut')).toBe(true);
    expect(machine.getContext().loginAttempts).toBe(1);
  });

  it('should lock account after 3 failed attempts', () => {
    const machine = createAuthMachine();

    // Attempt 1
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong1' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });
    expect(machine.getContext().loginAttempts).toBe(1);

    // Attempt 2
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong2' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });
    expect(machine.getContext().loginAttempts).toBe(2);

    // Attempt 3 - should lock
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong3' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });

    expect(machine.getConfiguration().has('locked')).toBe(true);
    expect(machine.getContext().isLocked).toBe(true);
    expect(machine.getContext().loginAttempts).toBe(3);
  });

  it('should prevent login when account is locked', () => {
    const machine = createAuthMachine();

    // Lock the account
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });

    expect(machine.getConfiguration().has('locked')).toBe(true);

    // Try to submit with correct credentials
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'correct' });
    machine.send({ type: 'SUBMIT' });

    // Should remain locked
    expect(machine.getConfiguration().has('locked')).toBe(true);
  });

  it('should unlock account and reset attempts', () => {
    const machine = createAuthMachine();

    // Lock the account
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });

    // Unlock
    machine.send({ type: 'UNLOCK' });

    expect(machine.getConfiguration().has('loggedOut')).toBe(true);
    expect(machine.getContext().isLocked).toBe(false);
    expect(machine.getContext().loginAttempts).toBe(0);
    expect(machine.getContext().username).toBe('');
  });

  it('should allow login after unlocking', () => {
    const machine = createAuthMachine();

    // Lock and unlock
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });
    machine.send({ type: 'UNLOCK' });

    // Now login successfully
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'correct' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'SUCCESS', token: 'xyz789' });

    expect(machine.getConfiguration().has('loggedIn')).toBe(true);
    expect(machine.getContext().sessionToken).toBe('xyz789');
  });

  it('should test compound guard (and)', () => {
    const machine = createAuthMachine();

    // Has credentials but account is locked - AND should fail
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'test', password: 'pass' });

    // Manually lock the account
    (machine as any).context.isLocked = true;

    machine.send({ type: 'SUBMIT' });

    // Should go to locked, not authenticating
    expect(machine.getConfiguration().has('locked')).toBe(true);
  });

  it('should reject login without valid token', () => {
    const machine = createAuthMachine();

    machine.send({ type: 'ENTER_CREDENTIALS', username: 'alice', password: 'secret' });
    machine.send({ type: 'SUBMIT' });

    // Send success but without token (should fail guard)
    machine.send({ type: 'SUCCESS', token: '' });

    // Should remain in authenticating
    expect(machine.getConfiguration().has('authenticating')).toBe(true);
  });

  it('should handle complete authentication flow with retry', () => {
    const machine = createAuthMachine();

    // First attempt - fail
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'alice', password: 'wrong' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'FAILURE' });
    expect(machine.getContext().loginAttempts).toBe(1);

    // Second attempt - success
    machine.send({ type: 'ENTER_CREDENTIALS', username: 'alice', password: 'correct' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'SUCCESS', token: 'token123' });

    expect(machine.getConfiguration().has('loggedIn')).toBe(true);
    expect(machine.getContext().sessionToken).toBe('token123');
    expect(machine.getContext().loginAttempts).toBe(0); // Reset on success
  });
});
