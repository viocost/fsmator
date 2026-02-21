// Export new type system
export type {
  StateContext,
  BaseEvent,
  EventByType,
  Guard,
  GuardArgs,
  Assign,
  AssignArgs,
  GuardRef,
  TransitionConfig,
  TransitionTarget,
  OnTransitions,
  StateConfig,
  StateMachineConfig,
  StateValue,
  ActivityInstance,
  ActivityMetadata,
  StateCountersSnapshot,
  MachineSnapshot,
} from './types';

// Export guard combination helpers
export { and, or, not } from './types';

// Export utility functions for defining assigns and guards
export { defineAssigns, defineGuards } from './util';

// Export StateMachine class
export { StateMachine } from './state-machine';
