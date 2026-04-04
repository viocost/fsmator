/**
 * Example: Schema Hash
 *
 * Demonstrates how to use getHash() to generate a deterministic hash
 * of the state machine schema for version checking and compatibility.
 */

import { StateMachine, type StateMachineConfig } from '../src';

interface Context {
  count: number;
}

type Event = { type: 'INC' } | { type: 'DEC' } | { type: 'RESET' };

const config: StateMachineConfig<Context, Event> = {
  initial: 'idle',
  initialContext: { count: 0 },

  assigns: {
    increment: ({ context }) => ({ count: context.count + 1 }),
    decrement: ({ context }) => ({ count: context.count - 1 }),
    reset: () => ({ count: 0 }),
  },

  guards: {
    isPositive: ({ context }) => context.count > 0,
  },

  states: {
    idle: {
      on: {
        INC: { target: 'active', assign: 'increment' },
      },
    },
    active: {
      on: {
        INC: { assign: 'increment' },
        DEC: { target: 'idle', guard: 'isPositive', assign: 'decrement' },
        RESET: { target: 'idle', assign: 'reset' },
      },
    },
  },
};

console.log('=== Schema Hash Example ===\n');

const machine = new StateMachine(config).start();

// Get schema hash
const schemaHash = machine.getHash();
console.log('Schema hash:', schemaHash);
console.log('Hash length:', schemaHash.length, 'characters (MD5 hex)');

// Hash is stable across state changes
console.log('\nInitial state:', machine.getStateValue());
console.log('Initial context:', machine.getContext());
console.log('Hash:', machine.getHash());

machine.handle({ type: 'INC' });
console.log('\nAfter INC event:');
console.log('State:', machine.getStateValue());
console.log('Context:', machine.getContext());
console.log('Hash (unchanged):', machine.getHash());

// Verify hash is the same
console.log('\nHash is stable:', schemaHash === machine.getHash());

// Create another machine with same schema
const machine2 = new StateMachine(config);
console.log('\nSecond machine hash:', machine2.getHash());
console.log('Hashes match:', machine.getHash() === machine2.getHash());

// Different schema = different hash
const differentConfig: StateMachineConfig<Context, Event> = {
  initial: 'idle',
  initialContext: { count: 0 },
  states: {
    idle: {
      on: {
        INC: 'active', // Different transition structure
      },
    },
    active: {
      on: {
        RESET: 'idle',
      },
    },
  },
};

const differentMachine = new StateMachine(differentConfig);
console.log('\nDifferent schema hash:', differentMachine.getHash());
console.log('Hashes differ:', machine.getHash() !== differentMachine.getHash());

// Use case: Version compatibility check
console.log('\n=== Use Case: Snapshot Compatibility ===');
const snapshot = machine.getSnapshot();
const currentHash = machine.getHash();

// Simulate loading snapshot later
console.log('Saved snapshot hash:', currentHash);

// Before loading, verify schema compatibility
const restoredMachine = new StateMachine(config);
if (restoredMachine.getHash() === currentHash) {
  console.log('✓ Schema compatible - safe to load snapshot');
  restoredMachine.load(snapshot).start();
} else {
  console.log('✗ Schema mismatch - snapshot may be incompatible');
}
