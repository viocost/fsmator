# Fsmator

A synchronous state machine reducer engine for TypeScript with XState-compatible semantics.

## What is Fsmator?

Fsmator is a pure, synchronous state machine library that treats state machines as **reducers** - pure functions that take the current state and an event, and return the new state. Unlike XState which focuses on side effects and async operations, Fsmator is designed for:

- **Pure state management**: No side effects, no async, no runtime invocations
- **Synchronous execution**: Each event completes in a single "macro step"
- **Reducer-based architecture**: Perfect for integration with Redux, Zustand, or any reducer-based state management
- **Type-safe**: Full TypeScript support with comprehensive type inference
- **XState-compatible transitions**: Uses the same LCA (Least Common Ancestor) algorithm for predictable state transitions

## Approach

### Core Concepts

1. **Pure Functions**: All state transitions are pure - same input always produces same output
2. **Immutable Context**: Context (extended state) is never mutated, always returns new objects
3. **Synchronous Execution**: Events are processed immediately and completely
4. **Hierarchical States**: Support for compound (nested) and parallel states
5. **Guard-based Transitions**: Conditional transitions based on context and event data
6. **Entry/Exit Actions**: Execute context updates when entering/exiting states

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                  StateMachine                        │
│  ┌───────────────────────────────────────────────┐  │
│  │  Configuration (Set<nodeId>)                  │  │
│  │  Context (immutable)                          │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  send(event) → Macro Step:                          │
│    1. Select enabled transitions (with guards)      │
│    2. Compute LCA (Least Common Ancestor)           │
│    3. Exit states (leaf → root)                     │
│    4. Execute transition actions                    │
│    5. Enter states (root → leaf)                    │
│    6. Return new configuration + context            │
└─────────────────────────────────────────────────────┘
```

### State Node Types

- **Atomic**: Leaf states with no children
- **Compound**: Hierarchical states with an `initial` child state
- **Parallel**: States where all child regions are active simultaneously

### Transition Algorithm (XState-compatible)

When transitioning from state A to state B:

1. Find the **LCA** (Least Common Ancestor) of A and B
2. **Exit Set**: All states from A up to (but excluding) LCA
3. **Entry Set**: All states from LCA down to (and including) B
4. Execute in order:
   - Exit actions (leaf → root)
   - Transition assign action
   - Entry actions (root → leaf)

Example: Transitioning from `a.b.c` to `a.d.e`:

```
        a (LCA)
       / \
      b   d
     /     \
    c       e

Exit:  c → b
Enter: d → e
```

## Installation

```bash
npm install fsmator
# or
pnpm install fsmator
# or
yarn add fsmator
```

## Examples

This repository includes comprehensive examples demonstrating all features. See the [examples/](./examples/) folder for:

- **Flat State Machine**: Simple traffic light
- **Nested State Machine**: Form with hierarchical validation
- **Parallel State Machine**: Media player with independent controls
- **Context Changes**: Shopping cart with immutable updates
- **Guard Conditions**: Authentication with conditional transitions

Run all examples:

```bash
pnpm run examples
```

All examples run with `debug: true` to show detailed state machine operation logs.

## Usage

### Basic Example

```typescript
import { StateMachine } from 'fsmator';
import type { StateMachineConfig, StateContext, BaseEvent } from 'fsmator';

// Define your context
interface CounterContext extends StateContext {
  count: number;
}

// Define your events
type CounterEvents = { type: 'INCREMENT' } | { type: 'DECREMENT' } | { type: 'RESET' };

// Create configuration
const config: StateMachineConfig<CounterContext, CounterEvents> = {
  initialContext: { count: 0 },
  initial: 'active',

  // Define reducers (pure functions)
  reducers: {
    increment: ({ context }) => ({ count: context.count + 1 }),
    decrement: ({ context }) => ({ count: context.count - 1 }),
    reset: () => ({ count: 0 }),
  },

  states: {
    active: {
      on: {
        INCREMENT: { assign: 'increment' },
        DECREMENT: { assign: 'decrement' },
        RESET: { assign: 'reset' },
      },
    },
  },
};

// Initialize and start machine
const machine = new StateMachine(config).start();

// Send events
machine.send({ type: 'INCREMENT' });
machine.send({ type: 'INCREMENT' });
console.log(machine.getContext().count); // 2

machine.send({ type: 'DECREMENT' });
console.log(machine.getContext().count); // 1

machine.send({ type: 'RESET' });
console.log(machine.getContext().count); // 0

// Check current state
console.log(machine.getStateValue()); // "active"
```

### Hierarchical States with Entry/Exit Actions

```typescript
interface FormContext extends StateContext {
  log: string[];
  formData: { name: string; email: string };
}

type FormEvents =
  | { type: 'SUBMIT' }
  | { type: 'VALIDATE' }
  | { type: 'SUCCESS' }
  | { type: 'ERROR' };

const formConfig: StateMachineConfig<FormContext, FormEvents> = {
  initialContext: {
    log: [],
    formData: { name: '', email: '' },
  },
  initial: 'editing',

  reducers: {
    logEdit: ({ context }) => ({ log: [...context.log, 'editing'] }),
    logValidate: ({ context }) => ({ log: [...context.log, 'validating'] }),
    logSubmit: ({ context }) => ({ log: [...context.log, 'submitting'] }),
    logSuccess: ({ context }) => ({ log: [...context.log, 'success'] }),
  },

  states: {
    editing: {
      onEntry: ['logEdit'],
      on: {
        SUBMIT: { target: 'submitting' },
      },
    },

    submitting: {
      initial: 'validating',
      onEntry: ['logSubmit'],

      states: {
        validating: {
          onEntry: ['logValidate'],
          on: {
            SUCCESS: { target: 'done' },
            ERROR: { target: 'editing' },
          },
        },
        done: {
          onEntry: ['logSuccess'],
        },
      },
    },
  },
};

const machine = new StateMachine(formConfig).start();
// Initial: editing
// Log: ['editing']
console.log(machine.getStateValue()); // 'editing'

machine.send({ type: 'SUBMIT' });
// Now in: submitting.validating
// Log: ['editing', 'submitting', 'validating']
console.log(machine.getStateValue()); // { submitting: 'validating' }
```

### Guards for Conditional Transitions

```typescript
interface AuthContext extends StateContext {
  token: string | null;
  attempts: number;
}

type AuthEvents = { type: 'LOGIN'; token: string } | { type: 'LOGOUT' } | { type: 'RETRY' };

const authConfig: StateMachineConfig<AuthContext, AuthEvents> = {
  initialContext: { token: null, attempts: 0 },
  initial: 'loggedOut',

  guards: {
    hasToken: ({ context }) => context.token !== null,
    canRetry: ({ context }) => context.attempts < 3,
  },

  reducers: {
    saveToken: ({ context, event }) => (event.type === 'LOGIN' ? { token: event.token } : {}),
    clearToken: () => ({ token: null }),
    incrementAttempts: ({ context }) => ({ attempts: context.attempts + 1 }),
  },

  states: {
    loggedOut: {
      on: {
        LOGIN: [
          // Try transition with guard first
          { target: 'loggedIn', guard: 'hasToken', assign: 'saveToken' },
          // Fallback if guard fails
          { assign: 'incrementAttempts' },
        ],
      },
    },

    loggedIn: {
      on: {
        LOGOUT: { target: 'loggedOut', assign: 'clearToken' },
      },
    },
  },
};
```

### Parallel States

```typescript
interface MediaContext extends StateContext {
  volume: number;
  isPlaying: boolean;
}

type MediaEvents =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'VOLUME_UP' }
  | { type: 'VOLUME_DOWN' };

const mediaConfig: StateMachineConfig<MediaContext, MediaEvents> = {
  initialContext: { volume: 50, isPlaying: false },
  initial: 'player',

  reducers: {
    play: () => ({ isPlaying: true }),
    pause: () => ({ isPlaying: false }),
    volumeUp: ({ context }) => ({ volume: Math.min(100, context.volume + 10) }),
    volumeDown: ({ context }) => ({ volume: Math.max(0, context.volume - 10) }),
  },

  states: {
    player: {
      // Parallel state: both regions are active simultaneously
      states: {
        playback: {
          initial: 'paused',
          states: {
            playing: {
              on: { PAUSE: { target: 'paused', assign: 'pause' } },
            },
            paused: {
              on: { PLAY: { target: 'playing', assign: 'play' } },
            },
          },
        },

        volume: {
          initial: 'normal',
          states: {
            normal: {
              on: {
                VOLUME_UP: { assign: 'volumeUp' },
                VOLUME_DOWN: { assign: 'volumeDown' },
              },
            },
          },
        },
      },
    },
  },
};

const machine = new StateMachine(mediaConfig).start();
// Both player.playback.paused and player.volume.normal are active
console.log(machine.getStateValue());
// { player: { playback: 'stopped', volume: 'normal' } }

machine.send({ type: 'PLAY' });
machine.send({ type: 'VOLUME_UP' });
// Now: player.playback.playing and player.volume.normal
console.log(machine.getStateValue());
// { player: { playback: 'playing', volume: 'normal' } }
```

### Always Transitions (Eventless Transitions)

Always transitions fire automatically when entering a state, without requiring an event. They're useful for validation, routing, and auto-progression:

```typescript
interface ValidationContext extends StateContext {
  isValid: boolean;
  data: string;
}

type ValidationEvents = { type: 'INPUT'; data: string };

const config: StateMachineConfig<ValidationContext, ValidationEvents> = {
  initialContext: { isValid: false, data: '' },
  initial: 'input',

  guards: {
    isValid: ({ context }) => context.data.length > 0,
  },

  reducers: {
    saveData: ({ context, event }) => (event.type === 'INPUT' ? { data: event.data } : {}),
    validate: ({ context }) => ({ isValid: context.data.length > 0 }),
  },

  states: {
    input: {
      on: {
        INPUT: { target: 'validating', assign: 'saveData' },
      },
    },

    validating: {
      // Eventless transition - fires automatically on entry
      always: [{ target: 'valid', guard: 'isValid' }, { target: 'invalid' }],
    },

    valid: {},
    invalid: {},
  },
};

const machine = new StateMachine(config).start();
machine.send({ type: 'INPUT', data: 'hello' });
// Automatically transitions: input → validating → valid
```

Always transitions support:

- **Guards**: Conditional routing based on context
- **Assign actions**: Update context during transition
- **Chaining**: Multiple always transitions in sequence (max 100 iterations to prevent infinite loops)
- **Internal transitions**: Use `target: undefined` to stay in current state

### Final States

Mark states as final to indicate completion. When a machine enters a final state, it becomes halted and stops processing events:

```typescript
interface WorkflowContext extends StateContext {
  result: string;
}

type WorkflowEvents = { type: 'COMPLETE' } | { type: 'CANCEL' };

const config: StateMachineConfig<WorkflowContext, WorkflowEvents> = {
  initialContext: { result: '' },
  initial: 'working',

  reducers: {
    setResult: () => ({ result: 'completed' }),
  },

  states: {
    working: {
      on: {
        COMPLETE: { target: 'success', assign: 'setResult' },
        CANCEL: { target: 'cancelled' },
      },
    },

    success: {
      type: 'final', // Mark as final state
    },

    cancelled: {
      type: 'final', // Mark as final state
    },
  },
};

const machine = new StateMachine(config).start();
machine.send({ type: 'COMPLETE' });

console.log(machine.isHalted()); // true
machine.send({ type: 'CANCEL' }); // Silently ignored - machine is halted
```

### Snapshots (Save/Load State)

Serialize and restore machine state for persistence, hydration, or debugging:

```typescript
interface AppContext extends StateContext {
  userId: string;
  preferences: Record<string, any>;
}

const machine = new StateMachine(config).start();
machine.send({ type: 'LOGIN', userId: '123' });
machine.send({ type: 'UPDATE_PREFS', data: { theme: 'dark' } });

// Serialize to JSON string
const snapshot = machine.dump();
console.log(snapshot);
// {"configuration":["loggedIn"],"context":{"userId":"123",...},"halted":false}

// Save to localStorage, database, etc.
localStorage.setItem('machineState', snapshot);

// Later: restore from snapshot
const savedSnapshot = localStorage.getItem('machineState');
const restoredMachine = new StateMachine(config).load(savedSnapshot!).start(); // Must call start() after load

// Machine is fully restored with same state and context
console.log(restoredMachine.getContext().userId); // '123'
```

**Important**: The machine constructor no longer auto-starts. You **must** call `.start()` explicitly:

```typescript
// Fresh start
const machine = new StateMachine(config).start();

// Load from snapshot - MUST call start() after load
const machine = new StateMachine(config).load(snapshot).start();

// Sending without start() throws error
const machine = new StateMachine(config);
machine.send({ type: 'EVENT' }); // Error: Cannot send events: machine not started
```

### Time Travel (Development/Debugging)

Enable history tracking to rewind and fast-forward through state changes:

```typescript
const config: StateMachineConfig<Context, Event> = {
  initialContext: { count: 0 },
  initial: 'active',
  timeTravel: true, // Enable time travel (disabled by default)

  reducers: {
    increment: ({ context }) => ({ count: context.count + 1 }),
  },

  states: {
    active: {
      on: { INCREMENT: { assign: 'increment' } },
    },
  },
};

const machine = new StateMachine(config).start();

machine.send({ type: 'INCREMENT' }); // count: 1
machine.send({ type: 'INCREMENT' }); // count: 2
machine.send({ type: 'INCREMENT' }); // count: 3

console.log(machine.getHistoryIndex()); // 3
console.log(machine.getHistoryLength()); // 4 (initial + 3 events)

// Travel back in time
machine.rewind(2); // Go back 2 steps
console.log(machine.getContext().count); // 1

// Travel forward
machine.ff(1); // Fast-forward 1 step
console.log(machine.getContext().count); // 2

// Rewind and send new event - future history is truncated
machine.rewind(1);
machine.send({ type: 'INCREMENT' }); // Creates new timeline
console.log(machine.getHistoryLength()); // 3 (future was erased)
```

Time travel features:

- **Full state restoration**: Context, configuration, state counters, halted flag
- **History branching**: Sending events after rewind truncates future history
- **Boundary clamping**: Won't go before start or after end
- **Works with all features**: Nested states, parallel states, always transitions, final states

**Memory consideration**: Each snapshot captures the full machine state. Only enable `timeTravel: true` during development or debugging.

## Debugging

Fsmator includes comprehensive debug logging to help you understand exactly what's happening during state machine operations. Enable it by setting `debug: true` in your configuration:

```typescript
const config: StateMachineConfig<Context, Event> = {
  initial: 'idle',
  debug: true, // Enable debug logging
  initialContext: { count: 0 },
  states: {
    idle: {
      on: { START: 'active' },
    },
    active: {},
  },
};

const machine = new StateMachine(config).start();
machine.send({ type: 'START' });
```

Debug output shows:

- **Initialization**: Initial state activation
- **Events**: Each event received and current configuration
- **Transition Selection**: Which transitions are being checked and selected
- **Guards**: Guard evaluation results (PASS/FAIL)
- **LCA Computation**: Least Common Ancestor, exit set, and entry set
- **State Changes**: Entering and exiting states
- **Reducers**: Reducer execution and context updates
- **Final Configuration**: New active states after transitions

Example output:

```
🚀 Initializing state machine
➡️  Entering state: idle
✅ Initial configuration: [ 'idle' ]

📨 Event received: START
   Current configuration: [ 'idle' ]
🔍 Checking transitions for active atomic states: [ 'idle' ]
   Checking state: idle
   Found 1 transition(s) on event "START" in idle
   ✓ Selected transition: idle → active

🔀 Processing 1 transition(s)

🔀 Transition: idle → active
   LCA: __root__
   Exit set: [ 'idle' ]
   Entry set: [ 'active' ]
⬅️  Exiting state: idle
➡️  Entering state: active

✅ New configuration: [ 'active' ]
```

See `src/debug-example.ts` for a complete example with debug logging.

## API Reference

### `StateMachine<Context, Event>`

#### Constructor

```typescript
new StateMachine(config: StateMachineConfig<Context, Event>)
```

Creates a state machine. **Does not auto-start** - you must call `.start()` explicitly.

#### Methods

##### `start(): this`

Starts the machine by activating initial states or evaluating always transitions after loading a snapshot. Must be called before sending events.

```typescript
// Fresh start
const machine = new StateMachine(config).start();

// After loading snapshot
const machine = new StateMachine(config).load(snapshot).start();
```

##### `send(event: Event): void`

Processes an event and transitions the machine synchronously. Throws error if machine not started.

##### `getContext(): Context`

Returns the current context (extended state).

##### `getActiveStateNodes(): ReadonlySet<string>`

Returns the set of currently active state node IDs.

##### `getStateValue(): StateValue`

Returns the current state value in XState-compatible format.

- **Atomic states**: Returns a string (e.g., `"idle"`)
- **Compound states**: Returns a nested object (e.g., `{ form: "editing" }`)
- **Parallel states**: Returns an object with all active regions (e.g., `{ playback: "playing", volume: "muted" }`)

```typescript
// Atomic state
const machine = new StateMachine(config).start();
console.log(machine.getStateValue()); // "idle"

// Compound state
machine.send({ type: 'START' });
console.log(machine.getStateValue()); // { form: "editing" }

// Parallel state
console.log(machine.getStateValue()); // { playback: "playing", volume: "normal" }

// Deeply nested
console.log(machine.getStateValue()); // { app: { form: { step: "validation" } } }
```

##### `getNode(id: string): StateNode | undefined`

Gets a state node by its ID.

##### `dump(): string`

Serializes the current machine state to a JSON string. Includes configuration, context, state counters, and halted flag.

##### `load(snapshot: string): this`

Loads machine state from a JSON snapshot. **Does not start the machine** - you must call `.start()` after loading.

```typescript
const machine = new StateMachine(config).load(snapshot).start();
```

##### `isHalted(): boolean`

Returns `true` if the machine is in a final state. Halted machines silently ignore all events.

##### `rewind(steps?: number): void`

Go back in history (time travel). Only available when `timeTravel: true`. Default: 1 step.

##### `ff(steps?: number): void`

Fast-forward in history (time travel). Only works if not at the end of history. Only available when `timeTravel: true`. Default: 1 step.

##### `getHistoryIndex(): number`

Get current position in history. Only available when `timeTravel: true`.

##### `getHistoryLength(): number`

Get total history length. Only available when `timeTravel: true`.

### Types

#### `StateMachineConfig<Context, Event>`

```typescript
interface StateMachineConfig<Context, Event> {
  initialContext: Context;
  initial: string;
  debug?: boolean; // Enable debug logging (default: false)
  timeTravel?: boolean; // Enable history tracking for rewind/ff (default: false)
  guards?: Record<string | symbol, Guard<Context, Event>>;
  reducers?: Record<string | symbol, Reducer<Context, Event>>;
  on?: OnTransitions<Event>;
  states: Record<string, StateConfig<Event>>;
}
```

#### `StateConfig<Event>`

```typescript
interface StateConfig<Event> {
  type?: 'final' | 'parallel'; // 'final' marks state as terminal
  on?: OnTransitions<Event>;
  always?: AlwaysTransition[]; // Eventless transitions
  activities?: Array<string | symbol>;
  onEntry?: Array<string | symbol>; // Reducers to execute on entry
  onExit?: Array<string | symbol>; // Reducers to execute on exit
  initial?: string; // For compound states
  states?: Record<string, StateConfig<Event>>; // Child states
}
```

#### `Guard<Context, Event>`

```typescript
type Guard<Context, Event> = (args: { context: Context; event: Event; state: string }) => boolean;
```

#### `Reducer<Context, Event>`

```typescript
type Reducer<Context, Event> = (args: {
  context: Context;
  event: Event;
  state: string;
}) => Partial<Context>;
```

### Guard Combinators

```typescript
import { and, or, not } from 'fsmator';

const config = {
  guards: {
    isValid: ({ context }) => context.valid,
    isReady: ({ context }) => context.ready,
  },
  states: {
    idle: {
      on: {
        // Combine guards with logical operators
        SUBMIT: [
          { target: 'success', guard: and('isValid', 'isReady') },
          { target: 'error', guard: or(not('isValid'), not('isReady')) },
        ],
      },
    },
  },
};
```

## Development

```bash
# Install dependencies
pnpm install

# Build the library
pnpm run build

# Run tests
pnpm test

# Run tests with UI
pnpm run test:ui

# Run tests with coverage
pnpm run test:coverage

# Run linter
pnpm run lint

# Format code
pnpm run format

# Type check
pnpm run typecheck

# Development mode (watch)
pnpm run dev
```

## Key Differences from XState

| Feature                  | Fsmator                  | XState                             |
| ------------------------ | ------------------------------ | ---------------------------------- |
| **Execution Model**      | Synchronous, single macro step | Async with actors and side effects |
| **Side Effects**         | None (pure reducers only)      | Full support (invoke, spawn, etc.) |
| **Context Updates**      | Immutable, via reducers        | Mutable via assign actions         |
| **Primary Use Case**     | Pure state management          | Full-featured state orchestration  |
| **Bundle Size**          | Minimal (~5KB)                 | Larger (~30KB+)                    |
| **Transition Algorithm** | Same LCA-based algorithm       | Same LCA-based algorithm           |
| **TypeScript Support**   | Full type inference            | Full type inference                |

## Breaking Changes

### Version 0.2.0

**Machine must be explicitly started:**

```typescript
// ❌ Old - constructor auto-started
const machine = new StateMachine(config);
machine.send({ type: 'EVENT' });

// ✅ New - must call start() explicitly
const machine = new StateMachine(config).start();
machine.send({ type: 'EVENT' });
```

**Loading snapshots requires explicit start:**

```typescript
// ❌ Old - load() auto-started
const machine = new StateMachine(config).load(snapshot);
machine.send({ type: 'EVENT' });

// ✅ New - must call start() after load()
const machine = new StateMachine(config).load(snapshot).start();
machine.send({ type: 'EVENT' });
```

**Sending events before start() throws error:**

```typescript
const machine = new StateMachine(config);
machine.send({ type: 'EVENT' });
// Error: Cannot send events: machine not started. Call start() first.
```

**Migration guide:**

- Add `.start()` after all `new StateMachine(config)` calls
- Add `.start()` after all `.load(snapshot)` calls
- This change enables better control over initialization and always transition evaluation

## License

MIT
