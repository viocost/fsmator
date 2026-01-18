# 🤖 Fsmator

**A synchronous, pure state machine engine with XState-compatible semantics.**

## 🎮 Try It Live

**[Visualize and test your state machines in the interactive simulator →](https://viocost.github.io/fsmator-ui/)**

Build, debug, and explore state machine behavior in real-time with the visual editor.



https://github.com/user-attachments/assets/992ce2da-1fd7-47a4-97d3-bd710e8e0f43




---

Fsmator is a **logic engine**, not a runtime. It treats state machines strictly as **reducers**: pure functions that take the current state and an event, and return a new state.

It strips away the actor model, async operations, and side effects found in XState. You bring the event loop and I/O; Fsmator handles the complex transition logic.

## ⚡ Core Philosophy

- **Pure State Management:** No side effects, no promises, no timeouts. Just `(State, Event) => New State`.
- **Synchronous:** Events are processed immediately in a single macro step.
- **BYO Runtime:** Designed to integrate seamlessly with Redux, Zustand, or your own event loop.
- **Type-Safe:** First-class TypeScript support with full inference.

## ✨ Features

| Feature                    | Description                                                    |
| :------------------------- | :------------------------------------------------------------- |
| 🌳 **Hierarchical States** | Fully supported nested (compound) states.                      |
| ⚡ **Parallel States**     | Run orthogonal state regions simultaneously.                   |
| 🛡️ **Guards**              | Conditional transitions based on context and event data.       |
| 💾 **Immutable Context**   | Extended state (context) is updated via pure reducers.         |
| 🎬 **Entry/Exit Actions**  | Trigger logic when entering or leaving specific nodes.         |
| 🔄 **Always Transitions**  | Eventless transitions that fire automatically on entry.        |
| 📦 **Snapshots**           | Serialize full machine state to JSON for persistence.          |
| ⏪ **Time Travel**         | Built-in history tracking (Rewind/Fast-forward) for debugging. |

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
interface Context {
  count: number;
}
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
        RESET: { target: 'idle', assign: 'reset' }, // Transition and update
      },
    },
    idle: {
      on: { INC: 'active' }, // Simple transition
    },
  },
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

### Snapshots & Persistence

Save and restore the complete machine state, including context, active states, and activity counters. Perfect for SSR, local storage, or cross-tab synchronization.

```typescript
// Save state to JSON
const snapshot = machine.dump();
localStorage.setItem('fsm', snapshot);

// Later: restore from snapshot
const savedSnapshot = localStorage.getItem('fsm');
const restoredMachine = new StateMachine(config).load(savedSnapshot).start(); // Resume exactly where you left off

// Snapshots preserve everything:
console.log(restoredMachine.getContext()); // Original context
console.log(restoredMachine.getStateValue()); // Original state
console.log(restoredMachine.getStateCounters()); // Activity counters preserved
```

**What's included in a snapshot:**

- `context`: Current context (extended state)
- `configuration`: Active state node IDs
- `stateCounters`: Entry counts for each state (used for activity tracking)
- `stateHistory`: Shallow history state memory (if used)

```typescript
// Snapshot structure (parsed JSON)
interface MachineSnapshot<Context> {
  context: Context;
  configuration: string[]; // e.g., ["parent", "parent.child"]
  stateCounters: { [stateId: string]: number }; // e.g., { "idle": 3 }
  stateHistory?: { [parentId: string]: string }; // e.g., { "parent": "child2" }
}
```

### Time Travel & Debugging

Enable `timeTravel: true` to record state history and step backward/forward through transitions. Ideal for debugging, undo/redo, or replaying user interactions.

```typescript
const config: StateMachineConfig<Context, Event> = {
  initial: 'idle',
  initialContext: { count: 0 },
  timeTravel: true, // Enable history tracking
  states: {
    /* ... */
  },
};

const machine = new StateMachine(config).start();
// History: [snapshot0]

machine.send({ type: 'INC' }); // count = 1
// History: [snapshot0, snapshot1]

machine.send({ type: 'INC' }); // count = 2
// History: [snapshot0, snapshot1, snapshot2]

console.log(machine.getHistoryLength()); // 3
console.log(machine.getHistoryIndex()); // 2 (current position)

// Rewind to previous state
machine.rewind(); // Back to count = 1 (index 1)
machine.rewind(2); // Back to count = 0 (index 0)

// Fast-forward through history
machine.ff(); // Forward to count = 1 (index 1)
machine.ff(2); // Forward to count = 2 (index 2)

// Current state is restored from history
console.log(machine.getContext().count); // 2
```

**Time travel API:**

- `rewind(steps?: number)`: Move backward in history (default: 1 step)
- `ff(steps?: number)`: Move forward in history (default: 1 step)
- `getHistoryLength()`: Total snapshots stored
- `getHistoryIndex()`: Current position in history (0-based)

**Important:** New events sent after rewinding will **truncate** future history (like undo/redo in most editors).

```typescript
machine.send({ type: 'INC' }); // count = 1
machine.send({ type: 'INC' }); // count = 2
machine.rewind(); // count = 1 (history: [0, 1, 2], index: 1)

// Sending a new event truncates "future" history
machine.send({ type: 'RESET' }); // count = 0 (history: [0, 1, 0], index: 2)
// The previous "count = 2" snapshot is discarded
```

### Activity Tracking & State Entry Counters

**Fsmator has NO side effects.** It does not run activities, invoke services, or perform I/O. Activities are expected to be implemented and tracked **externally** by your runtime.

For convenience, Fsmator provides **activity counters** to help you track which activities should be running and whether they are still relevant.

#### Defining Activities

Declare activities in state node configurations. These are just identifiers—Fsmator tracks when they should start/stop, but does not execute them.

```typescript
const config: StateMachineConfig<Context, Event> = {
  initial: 'idle',
  initialContext: {},
  states: {
    idle: {
      on: { FETCH: 'loading' },
    },
    loading: {
      activities: ['fetchData', 'showSpinner'], // Activity identifiers
      on: { SUCCESS: 'success', ERROR: 'error' },
    },
    success: {},
    error: {},
  },
};
```

#### Tracking Active Activities

Use `getActiveActivities()` to get metadata for all currently active activities:

```typescript
const machine = new StateMachine(config).start();
machine.send({ type: 'FETCH' });

// Get all active activities
const activities = machine.getActiveActivities();
// Returns:
// [
//   { type: 'fetchData', stateId: 'loading', instanceId: 1 },
//   { type: 'showSpinner', stateId: 'loading', instanceId: 1 }
// ]
```

#### Activity Relevance Checking

When a state is **re-entered**, its entry counter increments. This invalidates old activity instances:

```typescript
machine.send({ type: 'FETCH' }); // loading (instanceId: 1)
const activity1 = { type: 'fetchData', stateId: 'loading', instanceId: 1 };

machine.send({ type: 'ERROR' }); // → error state
machine.send({ type: 'FETCH' }); // → loading again (instanceId: 2)

// Old activity is no longer relevant
console.log(machine.isActivityRelevant(activity1)); // false

// New activity is relevant
const activity2 = { type: 'fetchData', stateId: 'loading', instanceId: 2 };
console.log(machine.isActivityRelevant(activity2)); // true
```

#### Activity Instance Identifiers

Get unique identifiers for activity instances:

```typescript
const metadata = { type: 'fetchData', stateId: 'loading', instanceId: 2 };
const instanceId = machine.getActivityInstance(metadata);
// Returns: "loading_2"
```

#### State Entry Counters

Access raw state entry counters directly:

```typescript
machine.getStateCounters();
// Returns: { "idle": 1, "loading": 2, "error": 1 }
```

**Use Case:** Integrate with your runtime (React, Redux, etc.) to start/stop side effects:

```typescript
// React example (pseudo-code)
useEffect(() => {
  const activities = machine.getActiveActivities();

  const cleanup = activities.map((activity) => {
    if (activity.type === 'fetchData') {
      return startFetchDataEffect(activity.instanceId);
    }
  });

  return () => cleanup.forEach((fn) => fn?.()); // Cleanup on unmount
}, [machine.getStateValue()]);
```

## ⚠️ Important Notes

1. **`.start()` is mandatory:** The constructor creates the instance, but `.start()` triggers the initial state entry and strictly evaluates initial "always" transitions.
2. **No Side Effects:** Fsmator will not run API calls or timers. If you need to fetch data on state entry, hook into your own runtime (e.g., React `useEffect` listening to `machine.getStateValue()`).

## License

MIT
