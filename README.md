# State Reducer

A lightweight and type-safe state machine library for TypeScript.

## Installation

```bash
pnpm install
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

## Usage

```typescript
import { createStateMachine, transition, canTransition } from 'state-reducer';

// Define your states and events
type State = 'idle' | 'loading' | 'success' | 'error';
type Event = 'FETCH' | 'SUCCESS' | 'ERROR' | 'RETRY';

// Create a state machine
const machine = createStateMachine<State, Event>({
  initialState: 'idle',
  states: {
    idle: {
      on: {
        FETCH: 'loading',
      },
    },
    loading: {
      on: {
        SUCCESS: 'success',
        ERROR: 'error',
      },
      onEnter: () => console.log('Loading...'),
    },
    success: {
      onEnter: () => console.log('Success!'),
    },
    error: {
      on: {
        RETRY: 'loading',
      },
      onEnter: () => console.log('Error occurred'),
    },
  },
});

// Transition between states
const nextMachine = transition(machine, 'FETCH');
console.log(nextMachine.currentState); // 'loading'

// Check if transition is possible
const canFetch = canTransition(machine, 'FETCH'); // true
```

## License

MIT
