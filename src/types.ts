/**
 * State context must extend object
 */
export type StateContext = object;

/**
 * Base event type with type discriminator
 */
export type BaseEvent = { type: string; [key: string]: unknown };

/**
 * Extract event by type
 */
export type EventByType<Event extends BaseEvent, Type extends Event['type']> = Extract<
  Event,
  { type: Type }
>;

/**
 * Arguments for guards and assigns
 */
export interface GuardArgs<Context extends StateContext, Event extends BaseEvent> {
  context: Context;
  event: Event;
  state: string;
}

export interface AssignArgs<Context extends StateContext, Event extends BaseEvent> {
  context: Context;
  event: Event;
  state: string;
}

/**
 * Guard function type - returns boolean to allow/deny transition
 */
export type Guard<Context extends StateContext, Event extends BaseEvent> = (
  args: GuardArgs<Context, Event>
) => boolean;

/**
 * Assign function type - returns partial context to merge into state, or void for no changes
 */
export type Assign<Context extends StateContext, Event extends BaseEvent> = (
  args: AssignArgs<Context, Event>
) => Partial<Context> | void;

/**
 * Guard reference - either a string/symbol reference or a logical combination
 */
export type GuardRef =
  | string
  | symbol
  | { type: 'ref'; id: string | symbol }
  | { type: 'and'; items: GuardRef[] }
  | { type: 'or'; items: GuardRef[] }
  | { type: 'not'; item: GuardRef };

/**
 * Transition target configuration (user-facing type)
 *
 * This is the configuration object users provide to specify a transition.
 * It can include:
 * - target: The destination state ID (optional for internal transitions)
 * - guard: A guard reference to conditionally enable the transition
 * - assign: An assign reference to update context during the transition
 *
 * @example
 * ```typescript
 * // External transition with guard
 * { target: 'active', guard: 'isEnabled' }
 *
 * // Internal transition (context-only, no state change)
 * { assign: 'increment' }
 * ```
 */
export interface TransitionConfig {
  target?: string;
  guard?: GuardRef;
  assign?: string | symbol;
}

/**
 * Transition target - can be a state name or config object with guard/assign references
 */
export type TransitionTarget = string | TransitionConfig | TransitionConfig[];

/**
 * "on" transitions - map event types to targets
 */
export type OnTransitions<Event extends BaseEvent> = Partial<
  Record<Event['type'], TransitionTarget>
>;

/**
 * State configuration - can include nested states
 */
export interface StateConfig<Event extends BaseEvent> {
  type?: 'final' | 'parallel';
  on?: OnTransitions<Event>;
  always?: TransitionTarget;
  activities?: Array<string | symbol>;
  onEntry?: Array<string | symbol>;
  onExit?: Array<string | symbol>;
  initial?: string;
  states?: Record<string, StateConfig<Event>>;
  history?: boolean; // Enable shallow history for this compound state
}

/**
 * Top-level state machine configuration
 */
export interface StateMachineConfig<Context extends StateContext, Event extends BaseEvent> {
  initialContext: Context;
  guards?: Record<string | symbol, Guard<Context, Event>>;
  assigns?: Record<string | symbol, Assign<Context, Event>>;
  initial: string;
  on?: OnTransitions<Event>;
  states: Record<string, StateConfig<Event>>;
  debug?: boolean;
  timeTravel?: boolean; // Enable time travel (rewind/ff) with history snapshots
}

/**
 * State value - can be a string or nested object for compound states
 */
export type StateValue = string | { [key: string]: StateValue };

/**
 * Activity instance identifier - combines state ID and instance ID
 * Format: {stateId}_{instanceId}
 * Example: "submitting.validating_3" means the 3rd instance of the validating state
 */
export type ActivityInstance = string;

/**
 * Activity metadata for relevance checking
 *
 * The instanceId corresponds to the state's entry counter at the time the activity was created.
 * This allows external systems to track which specific instance of a state's activities are relevant.
 */
export interface ActivityMetadata {
  type: string | symbol; // Activity type identifier
  stateId: string; // State node ID where activity is defined
  instanceId: number; // Activity instance ID (corresponds to state entry counter)
}

/**
 * Snapshot of state entry counters for serialization
 *
 * Maps state IDs to their entry counters (how many times each state has been entered).
 */
export interface StateCountersSnapshot {
  [stateId: string]: number;
}

/**
 * Snapshot of shallow history states
 *
 * Maps compound state IDs to their last active child state ID
 */
export interface StateHistorySnapshot {
  [compoundStateId: string]: string;
}

/**
 * Machine snapshot including context, configuration, and state entry counters
 */
export interface MachineSnapshot<Context extends StateContext> {
  context: Context;
  configuration: string[];
  stateCounters: StateCountersSnapshot;
  stateHistory?: StateHistorySnapshot; // Shallow history tracking
}

/**
 * State machine instance
 */
export interface StateMachine<Context extends StateContext, Event extends BaseEvent> {
  currentState: StateValue;
  context: Context;
  config: StateMachineConfig<Context, Event>;
}

/**
 * Helper functions for combining guard references
 */
export function and(...guards: GuardRef[]): GuardRef {
  return { type: 'and', items: guards };
}

export function or(...guards: GuardRef[]): GuardRef {
  return { type: 'or', items: guards };
}

export function not(guard: GuardRef): GuardRef {
  return { type: 'not', item: guard };
}

export type AssignEntry<Context extends StateContext, Event extends BaseEvent> =
  | Assign<Context, Event>
  | {
      [T in Event['type']]: {
        event: T;
        handler: Assign<Context, Extract<Event, { type: T }>>;
      };
    }[Event['type']];

export type GuardEntry<Context extends StateContext, Event extends BaseEvent> =
  | Guard<Context, Event>
  | {
      [T in Event['type']]: {
        event: T;
        handler: Guard<Context, Extract<Event, { type: T }>>;
      };
    }[Event['type']];
