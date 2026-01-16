# State Reducer

A synchronous state machine reducer engine for TypeScript with XState-compatible semantics.

## What is State Reducer?

State Reducer is a pure, synchronous state machine library that treats state machines as **reducers** - pure functions that take the current state and an event, and return the new state. Unlike XState which focuses on side effects and async operations, State Reducer is designed for:

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
npm install state-reducer
# or
pnpm install state-reducer
# or
yarn add state-reducer
```

## Usage

### Basic Example

```typescript
import { StateMachine } from 'state-reducer';
import type { StateMachineConfig, StateContext, BaseEvent } from 'state-reducer';

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

// Initialize machine (auto-activates initial state)
const machine = new StateMachine(config);

// Send events
machine.send({ type: 'INCREMENT' });
machine.send({ type: 'INCREMENT' });
console.log(machine.getContext().count); // 2

machine.send({ type: 'DECREMENT' });
console.log(machine.getContext().count); // 1

machine.send({ type: 'RESET' });
console.log(machine.getContext().count); // 0
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

const machine = new StateMachine(formConfig);
// Initial: editing
// Log: ['editing']

machine.send({ type: 'SUBMIT' });
// Now in: submitting.validating
// Log: ['editing', 'submitting', 'validating']
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

const machine = new StateMachine(mediaConfig);
// Both player.playback.paused and player.volume.normal are active

machine.send({ type: 'PLAY' });
machine.send({ type: 'VOLUME_UP' });
// Now: player.playback.playing and player.volume.normal
```

## Debugging

State Reducer includes comprehensive debug logging to help you understand exactly what's happening during state machine operations. Enable it by setting `debug: true` in your configuration:

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

const machine = new StateMachine(config);
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

Creates and initializes a state machine. The initial state is automatically activated.

#### Methods

##### `send(event: Event): void`

Processes an event and transitions the machine synchronously.

##### `getContext(): Context`

Returns the current context (extended state).

##### `getConfiguration(): ReadonlySet<string>`

Returns the set of currently active state node IDs.

##### `getNode(id: string): StateNode | undefined`

Gets a state node by its ID.

### Types

#### `StateMachineConfig<Context, Event>`

```typescript
interface StateMachineConfig<Context, Event> {
  initialContext: Context;
  initial: string;
  debug?: boolean; // Enable debug logging (default: false)
  guards?: Record<string | symbol, Guard<Context, Event>>;
  reducers?: Record<string | symbol, Reducer<Context, Event>>;
  on?: OnTransitions<Event>;
  states: Record<string, StateConfig<Event>>;
}
```

#### `StateConfig<Event>`

```typescript
interface StateConfig<Event> {
  on?: OnTransitions<Event>;
  always?: AlwaysTransition[];
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
import { and, or, not } from 'state-reducer';

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

| Feature                  | State Reducer                  | XState                             |
| ------------------------ | ------------------------------ | ---------------------------------- |
| **Execution Model**      | Synchronous, single macro step | Async with actors and side effects |
| **Side Effects**         | None (pure reducers only)      | Full support (invoke, spawn, etc.) |
| **Context Updates**      | Immutable, via reducers        | Mutable via assign actions         |
| **Primary Use Case**     | Pure state management          | Full-featured state orchestration  |
| **Bundle Size**          | Minimal (~5KB)                 | Larger (~30KB+)                    |
| **Transition Algorithm** | Same LCA-based algorithm       | Same LCA-based algorithm           |
| **TypeScript Support**   | Full type inference            | Full type inference                |

## License

MIT
