# Agent Development Guide

This document provides coding guidelines for AI agents working on the state-reducer codebase.

## Quick Reference

### Build/Test Commands

```bash
# Development
pnpm run dev              # Watch mode for development
pnpm run build            # Build the library (creates dist/)
pnpm run typecheck        # TypeScript type checking

# Testing
pnpm test                 # Run all tests
pnpm test <filename>      # Run specific test file (e.g., pnpm test debug.test.ts)
pnpm run test:ui          # Run tests with UI
pnpm run test:coverage    # Run tests with coverage report

# Code Quality
pnpm run lint             # Lint TypeScript files
pnpm run lint:fix         # Auto-fix linting issues
pnpm run format           # Format code with Prettier
pnpm run format:check     # Check formatting without changes
```

### Running a Single Test File

```bash
pnpm test state-machine.test.ts    # Run specific test file
pnpm exec vitest state-node.test.ts     # Alternative using vitest directly
```

## Architecture Overview

**State Reducer** is a synchronous state machine library with XState-compatible semantics:

- **Pure functions only**: All state transitions are immutable and deterministic
- **No side effects**: No async operations, no invocations, no spawn
- **LCA-based transitions**: Uses Least Common Ancestor algorithm for nested state transitions
- **TypeScript-first**: Comprehensive type safety throughout

### Core Components

1. **StateMachine** (`src/state-machine.ts`): Orchestrates everything, holds configuration and context
2. **StateNode** (`src/state-node.ts`): Represents nodes in the state hierarchy tree
3. **Types** (`src/types.ts`): All type definitions including guards, reducers, transitions

## Code Style Guidelines

### Imports

- Use named imports from local modules: `import { StateMachine } from './state-machine'`
- Use type-only imports when importing only types: `import type { Guard, Reducer } from './types'`
- Group imports: external packages first, then local modules, then types
- Order: vitest imports → local class imports → type imports

```typescript
import { describe, it, expect } from 'vitest';
import { StateMachine } from './state-machine';
import type { StateMachineConfig } from './types';
```

### Formatting (Prettier)

- **Semi-colons**: Always (`;`)
- **Quotes**: Single quotes (`'`)
- **Print width**: 100 characters
- **Tab width**: 2 spaces (no tabs)
- **Trailing commas**: ES5 style (objects, arrays)
- **Arrow parens**: Always `(x) => x`

### TypeScript

- **Strict mode enabled**: All strict checks are on
- **No explicit any**: Use `any` sparingly (eslint warns on it)
- **No unused vars**: Prefix with `_` to ignore (e.g., `_eventType`)
- **Return types**: Not required (inferred), but add for public APIs
- **Null checks**: Always check indexed access (`noUncheckedIndexedAccess: true`)

### Naming Conventions

- **Classes**: PascalCase (`StateMachine`, `StateNode`)
- **Interfaces/Types**: PascalCase (`StateMachineConfig`, `GuardRef`)
- **Variables/functions**: camelCase (`getContext`, `selectedTransitions`)
- **Constants**: camelCase (no SCREAMING_SNAKE_CASE)
- **Private fields**: camelCase with `private` keyword (`private debugEnabled`)
- **Unused params**: Prefix with underscore (`_contextNode`)
- **Generic types**: Descriptive names (`Context`, `Event`, not `T`, `E`)

### Types vs Interfaces

- Use `type` for unions, intersections, and type aliases
- Use `interface` for object shapes that might be extended
- Export types from `types.ts`, re-export from `index.ts`

### Comments and Documentation

- Use JSDoc comments (`/** */`) for public APIs and complex logic
- Explain **why**, not **what** (code should be self-documenting)
- Document algorithms with clear step-by-step explanations
- Add inline comments for non-obvious logic

```typescript
/**
 * Main event handler - processes an event and transitions the machine
 *
 * Algorithm:
 * 1. Select enabled transitions from current configuration
 * 2. For each transition, compute exit and entry sets using LCA
 * 3. Execute exits (leaf to root order)
 * 4. Execute transition assigns
 * 5. Execute entries (root to leaf order)
 * 6. Update configuration and context
 */
send(event: Event): void {
  // Implementation
}
```

### Error Handling

- Throw descriptive errors with context: `throw new Error(\`Target state "\${targetId}" not found\`)`
- Validate inputs early (fail fast)
- Don't catch errors unless you can handle them meaningfully
- Use template literals for error messages with variables

### Testing (Vitest)

- One test file per source file: `state-machine.ts` → `state-machine.test.ts`
- Use `describe` blocks for grouping related tests
- Use descriptive test names: `it('should log guard evaluation when debug is enabled')`
- Follow AAA pattern: Arrange, Act, Assert
- Use `expect().toBe()` for primitives, `.toEqual()` for objects
- Mock with `vi.spyOn()` and restore with `.mockRestore()` in `afterEach`

```typescript
describe('StateMachine', () => {
  describe('initialization', () => {
    it('should activate initial state on construction', () => {
      // Arrange
      const config: StateMachineConfig<Context, Event> = {
        /* ... */
      };

      // Act
      const machine = new StateMachine(config);

      // Assert
      expect(machine.getConfiguration().has('idle')).toBe(true);
    });
  });
});
```

### Pure Functions and Immutability

- **Never mutate**: Always return new objects/arrays
- Context updates: `return { ...context, ...updates }`
- Array updates: Use spread, map, filter (never push/splice on original)
- Configuration: Create new Set, never modify existing

```typescript
// Good
const newContext = { ...context, count: context.count + 1 };
const newConfig = new Set(this.configuration);

// Bad
context.count++; // Mutation!
this.configuration.add(nodeId); // Mutation!
```

## Development Workflow

1. **Make changes**: Edit source files in `src/`
2. **Type check**: Run `pnpm run typecheck` to verify types
3. **Test**: Run `pnpm test` to ensure all tests pass
4. **Format**: Run `pnpm run format` before committing
5. **Build**: Run `pnpm run build` to verify the build succeeds

## Key Implementation Details

- **Two-pass compilation**: Build node tree first, then resolve target IDs (handles sibling references)
- **Configuration is Set<string>**: Active node IDs stored in a Set
- **Context is immutable**: All reducers return `Partial<Context>`, merged with spread
- **Guards can be compound**: Support `and`, `or`, `not` logical combinators
- **Transitions can be**: internal (no target), self-transitions, or external (with LCA computation)

## Common Patterns

### Adding Debug Logging

```typescript
private log(message: string, ...args: any[]): void {
  if (this.debugEnabled) {
    console.log(message, ...args);
  }
}
```

### Executing Reducers (Pure)

```typescript
private executeReducer(reducerRef: string | symbol, context: Context, event: Event, state: string): Context {
  const reducer = this.getReducer(reducerRef);
  const updates = reducer({ context, event, state });
  return { ...context, ...updates };  // Immutable update
}
```

### Guard Evaluation (Recursive)

```typescript
private evaluateGuard(guardRef: GuardRef, context: Context, event: Event, state: string): boolean {
  if (typeof guardRef === 'string' || typeof guardRef === 'symbol') {
    const guard = this.getGuard(guardRef);
    return guard({ context, event, state });
  }
  // Handle compound guards: and/or/not
}
```

## Notes for Agents

- This is a **pure reducer library**, not a full state machine framework like XState
- No async, no side effects, no actors/spawning/invocations
- All state changes happen synchronously in a single "macro step"
- Perfect for integration with Redux, Zustand, or React's useReducer
- XState-compatible transition semantics (LCA algorithm) for predictable behavior
