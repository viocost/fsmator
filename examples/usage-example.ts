/**
 * Example usage demonstrating the typing system
 */

import {
  StateContext,
  StateMachineConfig,
  Reducer,
  Guard,
  TypedReducer,
  EventByType,
  and,
  or,
  not,
} from './types';

// Define your context type
interface MyContext extends StateContext {
  counter: number;
  message: string;
}

// Define your events
type Events =
  | { type: 'add'; value: number }
  | { type: 'subtract'; value: number }
  | { type: 'reset' }
  | { type: 'setMessage'; text: string };

// Example 1: Basic reducers with manual narrowing
const basicReducers: Record<string, Reducer<MyContext, Events>> = {
  ADD: ({ context, event }) => {
    // Manual narrowing
    if (event.type !== 'add') return {};
    return { counter: context.counter + event.value };
  },
  SUBTRACT: ({ context, event }) => {
    if (event.type !== 'subtract') return {};
    return { counter: context.counter - event.value };
  },
  RESET: () => {
    return { counter: 0 };
  },
  SET_MESSAGE: ({ event }) => {
    if (event.type !== 'setMessage') return {};
    return { message: event.text };
  },
};

// Example 2: Typed reducers with automatic narrowing (cleaner)
const typedReducers = {
  ADD: (({ context, event }) => {
    // event is automatically narrowed to { type: 'add'; value: number }
    return { counter: context.counter + event.value };
  }) satisfies TypedReducer<MyContext, Events, 'add'>,

  SUBTRACT: (({ context, event }) => {
    return { counter: context.counter - event.value };
  }) satisfies TypedReducer<MyContext, Events, 'subtract'>,

  SET_MESSAGE: (({ event }) => {
    return { message: event.text };
  }) satisfies TypedReducer<MyContext, Events, 'setMessage'>,
};

// Example 3: Guards with narrowing
const guards: Record<string, Guard<MyContext, Events>> = {
  CAN_ADD: ({ context, event }) => {
    if (event.type !== 'add') return false;
    return context.counter + event.value <= 100;
  },
  IS_POSITIVE: ({ context }) => {
    return context.counter > 0;
  },
  IS_ZERO: ({ context }) => {
    return context.counter === 0;
  },
};

// Example 4: Full state machine configuration with guard/reducer references
const config: StateMachineConfig<MyContext, Events> = {
  initialContext: {
    counter: 0,
    message: 'Hello',
  },
  initial: 'idle',

  // Top-level guards and reducers
  guards,
  reducers: basicReducers,

  // Top-level transitions
  on: {
    reset: { target: 'idle', assign: 'RESET' },
  },

  states: {
    idle: {
      on: {
        add: [
          {
            // Reference guards by name, can combine with and/or/not
            guard: and('CAN_ADD', 'IS_ZERO'),
            assign: 'ADD',
            target: 'active',
          },
          {
            // Just assign without transition
            assign: 'ADD',
          },
        ],
      },
    },
    active: {
      on: {
        add: { assign: 'ADD' },
        subtract: { assign: 'SUBTRACT' },
        setMessage: { assign: 'SET_MESSAGE' },
      },
      // Always transitions checked after every event
      always: [
        {
          guard: 'IS_ZERO',
          target: 'idle',
        },
        {
          guard: or('IS_POSITIVE', not('CAN_ADD')),
          assign: 'RESET',
        },
      ],
    },
  },
};

// Type checking demonstration
type AddEvent = EventByType<Events, 'add'>;
type SubtractEvent = EventByType<Events, 'subtract'>;

// These should be correctly typed
const addEvent: AddEvent = { type: 'add', value: 5 };
const subtractEvent: SubtractEvent = { type: 'subtract', value: 3 };

export { config, basicReducers, typedReducers, guards, addEvent, subtractEvent };

// Example 5: Nested/Hierarchical states (like XState)
interface FormContext extends StateContext {
  formData: {
    name: string;
    email: string;
  };
  errors: string[];
}

type FormEvents =
  | { type: 'SUBMIT' }
  | { type: 'EDIT' }
  | { type: 'VALIDATE' }
  | { type: 'RETRY' };

const formConfig: StateMachineConfig<FormContext, FormEvents> = {
  initialContext: {
    formData: { name: '', email: '' },
    errors: [],
  },
  initial: 'editing',
  
  states: {
    editing: {
      on: {
        SUBMIT: { target: 'submitting' },
      },
    },
    
    // Compound state with nested substates
    submitting: {
      initial: 'validating',
      states: {
        validating: {
          on: {
            VALIDATE: [
              { target: 'sending' },
            ],
          },
        },
        sending: {
          on: {
            SUBMIT: { target: 'success' },
            RETRY: { target: 'validating' },
          },
        },
        success: {
          // Final substate
        },
      },
      on: {
        EDIT: { target: 'editing' },
      },
    },
    
    success: {
      // Top-level success state
    },
  },
};

export { formConfig };
