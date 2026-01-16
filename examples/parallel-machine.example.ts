/**
 * Example: Parallel State Machine
 * A media player with independent playback and volume controls
 */

import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

type MediaContext = {
  volume: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  events: string[];
};

type MediaEvent =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'VOLUME_UP' }
  | { type: 'VOLUME_DOWN' }
  | { type: 'MUTE' }
  | { type: 'UNMUTE' };

export function runParallelMachineExample() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 3: Parallel State Machine (Media Player)');
  console.log('='.repeat(80));

  const config: StateMachineConfig<MediaContext, MediaEvent> = {
    initial: 'player',
    debug: true,
    initialContext: {
      volume: 50,
      currentTime: 0,
      duration: 180,
      isPlaying: false,
      events: [],
    },
    states: {
      player: {
        // Parallel state: both playback and volume are active simultaneously
        states: {
          playback: {
            initial: 'stopped',
            states: {
              stopped: {
                onEntry: ['logStopped'],
                on: {
                  PLAY: { target: 'playing', assign: 'setPlaying' },
                },
              },
              playing: {
                onEntry: ['logPlaying'],
                on: {
                  PAUSE: { target: 'paused', assign: 'setPaused' },
                  STOP: { target: 'stopped', assign: 'setStopped' },
                },
              },
              paused: {
                onEntry: ['logPaused'],
                on: {
                  PLAY: { target: 'playing', assign: 'setPlaying' },
                  STOP: { target: 'stopped', assign: 'setStopped' },
                },
              },
            },
          },
          volume: {
            initial: 'normal',
            states: {
              normal: {
                onEntry: ['logNormalVolume'],
                on: {
                  VOLUME_UP: { assign: 'increaseVolume' },
                  VOLUME_DOWN: { assign: 'decreaseVolume' },
                  MUTE: 'muted',
                },
              },
              muted: {
                onEntry: ['logMuted'],
                on: {
                  UNMUTE: 'normal',
                },
              },
            },
          },
        },
      },
    },
    reducers: {
      logStopped: ({ context }) => {
        return {
          events: [...context.events, 'stopped'],
        };
      },
      logPlaying: ({ context }) => {
        return {
          events: [...context.events, 'playing'],
        };
      },
      logPaused: ({ context }) => {
        return {

          events: [...context.events, 'paused'],


        };
      },
      logNormalVolume: ({ context }) => {
        console.log('    [Player] Volume is normal');
        return {

          events: [...context.events, 'volume_normal'],

        };
      },
      logMuted: ({ context }) => {
        return {
          events: [...context.events, 'muted'],
        };
      },
      setPlaying: () => ({ isPlaying: true }),
      setPaused: () => ({ isPlaying: false }),
      setStopped: () => ({ isPlaying: false, currentTime: 0 }),
      increaseVolume: ({ context }) => ({
        volume: Math.min(100, context.volume + 10),
      }),
      decreaseVolume: ({ context }) => ({
        volume: Math.max(0, context.volume - 10),
      }),
    },
  };

  const machine = new StateMachine(config);

  console.log('\n--- Playing and adjusting volume independently ---');
  machine.send({ type: 'PLAY' }); // Start playback
  machine.send({ type: 'VOLUME_UP' }); // Increase volume while playing
  machine.send({ type: 'VOLUME_UP' }); // Increase again
  machine.send({ type: 'PAUSE' }); // Pause playback (volume state unchanged)

  console.log('\n--- Mute while paused ---');
  machine.send({ type: 'MUTE' }); // Mute while paused

  console.log('\n--- Resume and unmute ---');
  machine.send({ type: 'PLAY' }); // Resume playback
  machine.send({ type: 'UNMUTE' }); // Unmute

  console.log('\n--- Stop playback ---');
  machine.send({ type: 'STOP' }); // Stop (resets currentTime)

  console.log('\n--- Final State ---');
  console.log('Configuration:', Array.from(machine.getConfiguration()));
  console.log('Context:', machine.getContext());
}
