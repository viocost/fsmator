# State Reducer Examples

This folder contains comprehensive examples demonstrating various features of the fsmator library.

## Running Examples

Run all examples:

```bash
pnpm run examples
# or
npm run examples
```

The easiest way to run individual examples is to temporarily add a function call at the bottom of the example file:

```typescript
// At the bottom of any example file, add:
runFlatMachineExample(); // or whichever example function

// Then run:
npx tsx examples/flat-machine.example.ts
```

Alternatively, create your own runner script that imports and calls specific examples.

Run individual examples:

```bash
npx tsx examples/flat-machine.example.ts
npx tsx examples/nested-machine.example.ts
npx tsx examples/parallel-machine.example.ts
npx tsx examples/context-changes.example.ts
npx tsx examples/guard-conditions.example.ts
```

## Examples Overview

### 1. Flat Machine (`flat-machine.example.ts`)

A simple traffic light state machine with no nesting.

**Demonstrates:**

- Basic state transitions
- Simple reducers for context updates
- Flat state structure

**States:** `red` → `yellow` → `green` → `red`

### 2. Nested Machine (`nested-machine.example.ts`)

A form submission flow with hierarchical states.

**Demonstrates:**

- Nested (compound) states
- Entry/exit actions
- LCA-based transitions between nested states
- State hierarchy

**States:**

- `idle`
- `editing`
- `submitting`
  - `submitting.validating`
  - `submitting.sending`
  - `submitting.failed`
  - `submitting.success`

### 3. Parallel Machine (`parallel-machine.example.ts`)

A media player with independent playback and volume controls.

**Demonstrates:**

- Parallel states (multiple active regions)
- Independent state transitions
- Context updates across parallel regions

**Parallel regions:**

- `player.playback` (stopped/playing/paused)
- `player.volume` (normal/muted)

### 4. Context Changes (`context-changes.example.ts`)

A shopping cart demonstrating various context manipulation patterns.

**Demonstrates:**

- Immutable context updates
- Array manipulation (add/remove/update items)
- Object updates (user login/logout)
- Computed values (cart total)
- Complex nested data structures

**Operations:** Add items, update quantities, apply discounts, user login

### 5. Guard Conditions (`guard-conditions.example.ts`)

An authentication system with conditional transitions.

**Demonstrates:**

- Guard functions for conditional transitions
- Compound guards (`and`, `or`, `not`)
- Multiple transitions with different guards
- Guard evaluation order
- Context-based conditions

**Features:** Login with validation, account locking after failed attempts, unlock mechanism

## Debug Mode

All examples run with `debug: true` enabled, showing detailed logs of:

- State transitions
- Guard evaluations
- Reducer executions
- Context changes
- LCA computation (for nested transitions)

## Key Concepts Illustrated

- **Pure Functions**: All state updates are immutable
- **Synchronous Execution**: Events complete immediately
- **Type Safety**: Full TypeScript support
- **XState-Compatible**: Uses LCA algorithm for transitions
- **No Side Effects**: Pure reducers only
