import { AssignEntry, GuardEntry, BaseEvent, StateContext, Assign, Guard } from './types';

export const defineAssigns = <Context extends StateContext, Event extends BaseEvent>(assigns: {
  [K: string]: AssignEntry<Context, Event>;
}): Record<string, Assign<Context, Event>> => {
  const result: Record<string, Assign<Context, Event>> = {};

  for (const [key, entry] of Object.entries(assigns)) {
    if (typeof entry === 'function') {
      result[key] = entry;
    } else {
      result[key] = entry.handler as Assign<Context, Event>;
    }
  }

  return result;
};

export const defineGuards = <Context extends StateContext, Event extends BaseEvent>(guards: {
  [K: string]: GuardEntry<Context, Event>;
}): Record<string, Guard<Context, Event>> => {
  const result: Record<string, Guard<Context, Event>> = {};

  for (const [key, entry] of Object.entries(guards)) {
    if (typeof entry === 'function') {
      result[key] = entry;
    } else {
      result[key] = entry.handler as Guard<Context, Event>;
    }
  }

  return result;
};
