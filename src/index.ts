// Export new type system
export type {
  StateContext,
  BaseEvent,
  EventByType,
  Guard,
  GuardArgs,
  Reducer,
  ReducerArgs,
  TypedReducer,
  TypedGuard,
  GuardRef,
  TransitionConfig,
  TransitionTarget,
  OnTransitions,
  AlwaysTransition,
  StateConfig,
  StateMap,
  StateMachineConfig,
  StateValue,
  ActivityInstance,
  ActivityMetadata,
  StateCountersSnapshot,
  MachineSnapshot,
} from './types';

// Export guard combination helpers
export { and, or, not } from './types';

// Export StateMachine class
export { StateMachine } from './state-machine';
