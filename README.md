# 🤖 Fsmator

**A synchronous, pure state machine engine with XState-compatible semantics.**

Fsmator is a **logic engine**, not a runtime. It treats state machines strictly as **reducers**: pure functions that take the current state and an event, and return a new state.

It strips away the actor model, async operations, and side effects found in XState. You bring the event loop and I/O; Fsmator handles the complex transition logic.

## ⚡ Core Philosophy

- **Pure State Management:** No side effects, no promises, no timeouts. Just `(State, Event) => New State`.
- **Synchronous:** Events are processed immediately in a single macro step.
- **BYO Runtime:** Designed to integrate seamlessly with Redux, Zustand, or your own event loop.
- **Type-Safe:** First-class TypeScript support with full inference.

## ✨ Features

| Feature | Description |
| :--- | :--- |
| 🌳 **Hierarchical States** | Fully supported nested (compound) states. |
| ⚡ **Parallel States** | Run orthogonal state regions simultaneously. |
| 🛡️ **Guards** | Conditional transitions based on context and event data. |
| 💾 **Immutable Context** | Extended state (context) is updated via pure reducers. |
| 🎬 **Entry/Exit Actions** | Trigger logic when entering or leaving specific nodes. |
| 🔄 **Always Transitions** | Eventless transitions that fire automatically on entry. |
| 📦 **Snapshots** | Serialize full machine state to JSON for persistence. |
| ⏪ **Time Travel** | Built-in history tracking (Rewind/Fast-forward) for debugging. |

## 📦 Installation

```bash
npm install fsmator
# or
pnpm install fsmator
```

## 🚀 Quick Start

### 1. Define Config
Define your context, events, and the state machine structure. Note that we use **reducers** instead of `assign` actions to maintain purity.

```typescript
import { StateMachine, type StateMachineConfig } from 'fsmator';

// 1. Types
interface Context { count: number }
type Events = { type: 'INC' } | { type: 'RESET' };

// 2. Configuration
const config: StateMachineConfig<Context, Events> = {
  initial: 'active',
  initialContext: { count: 0 },

  // Pure functions to update context
  reducers: {
    increment: ({ context }) => ({ count: context.count + 1 }),
    reset: () => ({ count: 0 }),
  },

  states: {
    active: {
      on: {
        INC: { assign: 'increment' }, // Stay in state, update context
        RESET: { target: 'idle', assign: 'reset' } // Transition and update
      }
    },
    idle: {
      on: { INC: 'active' } // Simple transition
    }
  }
};
```

### 2. Run the Engine
Fsmator does not run itself. You must instantiate it, **start it**, and push events to it.

```typescript
// Initialize
const machine = new StateMachine(config).start();

// Send Events
machine.send({ type: 'INC' });
console.log(machine.getContext()); // { count: 1 }

// Check State
console.log(machine.getStateValue()); // "active"

// Transition
machine.send({ type: 'RESET' });
console.log(machine.getStateValue()); // "idle"
```

## 🛠 Advanced Usage

### Parallel & Nested States
Fsmator supports full statecharts capabilities.

```typescript
states: {
  player: {
    type: 'parallel', // Both regions active simultaneously
    states: {
      video: { initial: 'playing', states: { /* ... */ } },
      audio: { initial: 'muted', states: { /* ... */ } }
    }
  }
}
```

### Persistence (Snapshots)
Save and restore the machine state instantly. Perfect for SSR or local storage.

```typescript
const savedState = machine.dump(); // JSON string
localStorage.setItem('fsm', savedState);

// Later...
const newMachine = new StateMachine(config)
  .load(savedState)
  .start(); // Resume exactly where you left off
```

### Debugging & Time Travel
Enable `timeTravel: true` in config to step through history.

```typescript
machine.rewind(2); // Go back 2 steps
machine.ff(1);     // Go forward 1 step
console.log(machine.getHistoryLength());
```

## ⚠️ Important Notes

1. **`.start()` is mandatory:** The constructor creates the instance, but `.start()` triggers the initial state entry and strictly evaluates initial "always" transitions.
2. **No Side Effects:** Fsmator will not run API calls or timers. If you need to fetch data on state entry, hook into your own runtime (e.g., React `useEffect` listening to `machine.getStateValue()`).

## License

MIT
