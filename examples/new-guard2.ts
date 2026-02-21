import { StateContext } from '../src/types';

type Handler<Context, Event> = (args: {
  context: Context;
  event: Event;
}) => Partial<Context> | void;

type AssignEntry<Context, Event extends { type: string }> =
  | Handler<Context, Event>
  | {
      [T in Event['type']]: {
        event: T;
        handler: Handler<Context, Extract<Event, { type: T }>>;
      };
    }[Event['type']];

const defineAssigns = <Context, Event extends { type: string }>(assigns: {
  [K: string]: AssignEntry<Context, Event>;
}) => {
  const result: Record<string, AssignEntry<Context, Event>> = {};

  for (const [key, entry] of Object.entries(assigns)) {
    if (typeof entry === 'function') {
      result[key] = entry;
    } else {
      result[key] = entry.handler as AssignEntry<Context, Event>;
    }
  }

  return result;
};

// Define your context type
interface MyContext extends StateContext {
  counter: number;
  message: string;
}

type AssignHandler<Context, Event extends { type: string }> = (args: {
  context: Context;
  event: Event;
}) => Partial<Context> | void;

type AssignMap<Context, Events extends { type: string }> = {
  [E in Events as E['type']]?: AssignHandler<Context, E>;
};

const assigns2: AssignMap<MyContext, Events> = {
  add: ({ context, event }) => ({ counter: context.counter + event.value }),
  subtract: ({ context, event }) => ({ counter: context.counter - event.value }),
  reset: ({ context }) => ({ counter: 0 }), // event is irrelevant
  setMessage: ({ event }) => ({ message: event.text }),
  foobar: ({ context, event }) => {},
};
// Define your events
type Events =
  | { type: 'add'; value: number }
  | { type: 'subtract'; value: number }
  | { type: 'reset' }
  | { type: 'foobar' }
  | { type: 'setMessage'; text: string };

const assigns = defineAssigns<MyContext, Events>({
  one: ({ context, event }) => {
    // event is full union
    return {};
  },

  two: {
    event: 'subtract',
    handler: ({ context, event }) => {
      return { counter: context.counter - event.value };
    },
  },

  three: {
    event: 'add',
    handler: ({ context, event }) => {},
  },
});

const assigns3 = defineAssigns<MyContext, Events>({
  one: ({ context, event }) => {
    // event is full union
    return {};
  },
});
