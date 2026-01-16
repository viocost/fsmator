/**
 * State context must extend object
 */
export type StateContext = object;

/**
 * Base event type with type discriminator
 */
export type BaseEvent = { type: string; [key: string]: any };

/**
 * Extract event by type
 */
export type EventByType<Event extends BaseEvent, Type extends Event['type']> = Extract<
  Event,
  { type: Type }
>;

/**
 * Arguments for guards and reducers
 */
export interface GuardArgs<Context extends StateContext, Event extends BaseEvent> {
  context: Context;
  event: Event;
  state: string;
}

export interface ReducerArgs<Context extends StateContext, Event extends BaseEvent> {
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
 * Reducer function type - returns partial context to update state
 */
export type Reducer<Context extends StateContext, Event extends BaseEvent> = (
  args: ReducerArgs<Context, Event>
) => Partial<Context>;

/**
 * Typed reducer for specific event type (optional, for better type safety)
 */
export type TypedReducer<
  Context extends StateContext,
  Event extends BaseEvent,
  Type extends Event['type'],
> = (args: {
  context: Context;
  event: EventByType<Event, Type>;
  state: string;
}) => Partial<Context>;

/**
 * Typed guard for specific event type (optional, for better type safety)
 */
export type TypedGuard<
  Context extends StateContext,
  Event extends BaseEvent,
  Type extends Event['type'],
> = (args: { context: Context; event: EventByType<Event, Type>; state: string }) => boolean;

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
 * Transition target configuration
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
 * "always" transitions - unconditional transitions checked after every event
 */
export interface AlwaysTransition {
  target?: string;
  guard?: GuardRef;
  assign?: string | symbol;
}

/**
 * State configuration - can include nested states
 */
export interface StateConfig<Event extends BaseEvent> {
  type?: 'final' | 'parallel';
  on?: OnTransitions<Event>;
  always?: AlwaysTransition | AlwaysTransition[];
  activities?: Array<string | symbol>;
  onEntry?: Array<string | symbol>;
  onExit?: Array<string | symbol>;
  initial?: string;
  states?: Record<string, StateConfig<Event>>;
}

/**
 * Map of state names to state configurations
 */
export type StateMap<Context extends StateContext, Event extends BaseEvent> = {
  initial: string;
  guards?: Record<string | symbol, Guard<Context, Event>>;
  reducers?: Record<string | symbol, Reducer<Context, Event>>;
  on?: OnTransitions<Event>;
  states: Record<string, StateConfig<Event>>;
};

/**
 * Top-level state machine configuration
 */
export interface StateMachineConfig<Context extends StateContext, Event extends BaseEvent> {
  initialContext: Context;
  guards?: Record<string | symbol, Guard<Context, Event>>;
  reducers?: Record<string | symbol, Reducer<Context, Event>>;
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
 * Machine snapshot including context, configuration, and state entry counters
 */
export interface MachineSnapshot<Context extends StateContext> {
  context: Context;
  configuration: string[];
  stateCounters: StateCountersSnapshot;
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
