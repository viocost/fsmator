/**
 * Example: Guard Conditions
 * Demonstrates conditional transitions based on context and event data
 */

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

export function runGuardConditionsExample() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 5: Guard Conditions (Authentication System)');
  console.log('='.repeat(80));

  const config: StateMachineConfig<AuthContext, AuthEvent> = {
    initial: 'loggedOut',
    debug: true,
    initialContext: {
      username: '',
      password: '',
      loginAttempts: 0,
      isLocked: false,
      sessionToken: null,
    },
    states: {
      loggedOut: {
        onEntry: ['logLoggedOut'],
        on: {
          ENTER_CREDENTIALS: { assign: 'setCredentials' },
          SUBMIT: [
            // Guard 1: Check if account is locked
            {
              target: 'locked',
              guard: 'isAccountLocked',
            },
            // Guard 2: Check if credentials are valid (and not locked)
            {
              target: 'authenticating',
              guard: and('hasCredentials', not('isAccountLocked')),
            },
            // Fallback: Invalid credentials
            {
              assign: 'incrementAttempts',
            },
          ],
        },
      },
      authenticating: {
        onEntry: ['logAuthenticating'],
        on: {
          SUCCESS: [
            {
              target: 'loggedIn',
              guard: 'hasValidToken',
              assign: 'setToken',
            },
          ],
          FAILURE: [
            // Lock account if too many attempts
            {
              target: 'locked',
              guard: 'tooManyAttempts',
              assign: 'lockAccount',
            },
            // Otherwise go back to logged out
            {
              target: 'loggedOut',
              assign: 'incrementAttempts',
            },
          ],
        },
      },
      loggedIn: {
        onEntry: ['logLoggedIn'],
        on: {
          LOGOUT: { target: 'loggedOut', assign: 'clearSession' },
        },
      },
      locked: {
        onEntry: ['logLocked'],
        on: {
          UNLOCK: { target: 'loggedOut', assign: 'unlockAccount' },
        },
      },
    },
    guards: {
      hasCredentials: ({ context }) => {
        const hasUsername = context.username.length > 0;
        const hasPassword = context.password.length > 0;
        console.log(`    [Guard] hasCredentials: ${hasUsername && hasPassword}`);
        return hasUsername && hasPassword;
      },
      isAccountLocked: ({ context }) => {
        console.log(`    [Guard] isAccountLocked: ${context.isLocked}`);
        return context.isLocked;
      },
      tooManyAttempts: ({ context }) => {
        const tooMany = context.loginAttempts >= 2; // Lock after 3 attempts
        console.log(`    [Guard] tooManyAttempts (${context.loginAttempts + 1}): ${tooMany}`);
        return tooMany;
      },
      hasValidToken: ({ event }) => {
        if (event.type !== 'SUCCESS') return false;
        const valid = event.token && event.token.length > 0;
        console.log(`    [Guard] hasValidToken: ${valid}`);
        return Boolean(valid);
      },
    },
    reducers: {
      logLoggedOut: () => {
        console.log('    [App] User is logged out');
        return {};
      },
      logAuthenticating: () => {
        console.log('    [App] Authenticating user...');
        return {};
      },
      logLoggedIn: ({ context }) => {
        console.log(`    [App] User "${context.username}" logged in successfully`);
        return {};
      },
      logLocked: () => {
        console.log('    [App] Account is locked due to too many failed attempts');
        return {};
      },
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

  const machine = new StateMachine(config);

  console.log('\n--- Scenario 1: Successful login ---');
  machine.send({ type: 'ENTER_CREDENTIALS', username: 'alice', password: 'secret123' });
  machine.send({ type: 'SUBMIT' });
  machine.send({ type: 'SUCCESS', token: 'abc123xyz' });

  console.log('\n--- Scenario 2: Logout ---');
  machine.send({ type: 'LOGOUT' });

  console.log('\n--- Scenario 3: Failed login attempts leading to lock ---');
  machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'wrong' });
  machine.send({ type: 'SUBMIT' });
  machine.send({ type: 'FAILURE' }); // Attempt 1

  machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'stillwrong' });
  machine.send({ type: 'SUBMIT' });
  machine.send({ type: 'FAILURE' }); // Attempt 2

  machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'nope' });
  machine.send({ type: 'SUBMIT' });
  machine.send({ type: 'FAILURE' }); // Attempt 3 - should lock

  console.log('\n--- Scenario 4: Try to login while locked (guard prevents) ---');
  machine.send({ type: 'ENTER_CREDENTIALS', username: 'bob', password: 'correct' });
  machine.send({ type: 'SUBMIT' }); // Guard should prevent transition

  console.log('\n--- Scenario 5: Unlock account ---');
  machine.send({ type: 'UNLOCK' });

  console.log('\n--- Final State ---');
  console.log('Configuration:', Array.from(machine.getActiveStateNodes()));
  console.log('Context:', machine.getContext());
}
