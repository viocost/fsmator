import { StateMap, ReducerArgs, and, or, not, createMachine } from "fsmator";

interface StateContext {
  someProperty: string;
  counter: number;
}
type Reducer<StateContext, Event, StateId extends string> =
  (args: ReducerArgs<StateContext, Event, StateId>) => Partial<StateContext>;

const stateMap: StateMap<StateContext> = {
  guards: {
    SOME_GUARD: ({ context }) => context.someProperty !== "forbidden",
    ANOTHER_GUARD: ({ context }) => context.counter < 5,
    YET_ANOTHER_GUARD: ({ context }) => context.someProperty.startsWith("allow"),
    FINAL_GUARD: ({ context }) => context.counter >= 10,
  },

  reducers: {
    INCREMENT_COUNTER: ({ context }) => ({ counter: context.counter + 1 }),
    RESET_COUNTER: () => ({ counter: 0 }),
    SET_ALLOWED: () => ({ someProperty: "allowed" }),
    SET_FINAL: () => ({ someProperty: "final" }),
  },

  initial: "start",

  on: {
    someEvent: { assign: "INCREMENT_COUNTER" },

    reset: [
      { assign: "RESET_COUNTER" },
      { target: "start" },
    ],

    forceEnd: { target: "end" },
  },

  states: {
    start: {
      activities: ["ACTIVITY_ONE", "ACTIVITY_TWO"],

      on: {
        someOtherEvent: [
          { guard: "SOME_GUARD", target: "end" },
          { target: "middle" },
        ],

        anotherEvent: [
          {
            guard: and("SOME_GUARD", "ANOTHER_GUARD", "YET_ANOTHER_GUARD"),
            assign: "INCREMENT_COUNTER",
            target: "middle",
          },
          {
            guard: "SOME_GUARD",
            assign: "INCREMENT_COUNTER",
          },
        ],

        allow: { assign: "SET_ALLOWED" },

        finalize: { assign: "SET_FINAL" },
      },

      always: [
        {
          guard: "FINAL_GUARD",
          target: "end",
        },
        {
          guard: or(not("SOME_GUARD"), "FINAL_GUARD"),
          assign: "INCREMENT_COUNTER",
          target: "end",
        },
      ],
    },

    middle: {
      activities: ["ACTIVITY_THREE"],

      on: {
        tick: { assign: "INCREMENT_COUNTER" },

        goBack: { target: "start" },

        complete: [
          { guard: "FINAL_GUARD", target: "end" },
          { assign: "INCREMENT_COUNTER" },
        ],
      },

      always: [
        { guard: "FINAL_GUARD", target: "end" },
      ],
    },

    end: {
      activities: [],
    },
  },
};





const machine = createMachine(stateMap, {
  initialContext: { someProperty: "allow-x", counter: 0 },
});

const events = [...Array(15)].map(() => ({ type: "someEvent" } as const));

for (const event of events) {
  const result = machine.send(event);

  console.log(machine.state);
  console.log(machine.context);

  console.log(result.changed);
  console.log(result.transitionLog);
}

const snapshot = machine.dump();

machine.schema; // expanded/normalized schema


const restoredMachine = createMachine(snapshot)


type SendResult<StateContext, StateId extends string, Event> = {
  event: Event;
  handled: boolean;

  before: {
    state: StateId;
    context: StateContext;
    activeActivities: string[];
  };

  after: {
    state: StateId;
    context: StateContext;
    activeActivities: string[];
  };

  transitionLog: Array<{
    kind: "event" | "always";
    from: StateId;
    to: StateId;
    guardPath?: string[];
    reducersApplied: string[];
  }>;
};


const expandedGuards = {
  "type": "and",
  "items": [
    { "type": "ref", "id": "SOME_GUARD" },
    {
      "type": "or",
      "items": [
        { "type": "ref", "id": "A" },
        { "type": "not", "item": { "type": "ref", "id": "B" } }
      ]
    }
  ]
}
