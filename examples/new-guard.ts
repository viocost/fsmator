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
}) => assigns;

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
});
