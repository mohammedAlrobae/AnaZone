import { useRef, useState, useEffect, useCallback } from 'react';
import {
  type AnimationPlaybackControlsWithThen,
  type ValueAnimationTransition,
  animate,
  useMotionValue,
  useMotionValueEvent,
} from 'motion/react';
import {
  type AgentState,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
  useTrackVolume,
} from '@livekit/components-react';
import { LocalAudioTrack, RemoteAudioTrack } from 'livekit-client';

const DEFAULT_SPEED = 5;
const DEFAULT_AMPLITUDE = 0.08;
const DEFAULT_FREQUENCY = 10;
const DEFAULT_TRANSITION: ValueAnimationTransition = { duration: 0.2, ease: 'easeOut' };

function useAnimatedValue<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue);
  const motionValue = useMotionValue(initialValue);
  const controlsRef = useRef<AnimationPlaybackControlsWithThen | null>(null);
  useMotionValueEvent(motionValue, 'change', (value) => setValue(value as T));

  const animateFn = useCallback(
    (targetValue: T | T[], transition: ValueAnimationTransition) => {
      controlsRef.current = animate(motionValue, targetValue, transition);
    },
    [motionValue],
  );

  return { value, controls: controlsRef, animate: animateFn };
}

interface UseAgentAudioVisualizerWaveAnimatorArgs {
  state?: AgentState;
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder;
  volume?: number;
}

export function useAgentAudioVisualizerWave({
  state,
  audioTrack,
  volume: volumeProp,
}: UseAgentAudioVisualizerWaveAnimatorArgs) {
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const { value: amplitude, animate: animateAmplitude } = useAnimatedValue(DEFAULT_AMPLITUDE);
  const { value: frequency, animate: animateFrequency } = useAnimatedValue(DEFAULT_FREQUENCY);
  const { value: opacity, animate: animateOpacity } = useAnimatedValue(1.0);

  const trackVolume = useTrackVolume(audioTrack as TrackReference, {
    fftSize: 512,
    smoothingTimeConstant: 0.55,
  });
  const volume = volumeProp ?? trackVolume;

  useEffect(() => {
    switch (state) {
      case 'disconnected':
        setSpeed(DEFAULT_SPEED * 0.7);
        animateAmplitude(DEFAULT_AMPLITUDE * 0.45, DEFAULT_TRANSITION);
        animateFrequency(DEFAULT_FREQUENCY * 0.7, DEFAULT_TRANSITION);
        animateOpacity(0.9, DEFAULT_TRANSITION);
        return;
      case 'listening':
        setSpeed(DEFAULT_SPEED);
        animateAmplitude(DEFAULT_AMPLITUDE, DEFAULT_TRANSITION);
        animateFrequency(DEFAULT_FREQUENCY, DEFAULT_TRANSITION);
        animateOpacity([1.0, 0.4], {
          duration: 0.75,
          repeat: Infinity,
          repeatType: 'mirror',
        });
        return;
      case 'thinking':
      case 'connecting':
      case 'initializing':
        setSpeed(DEFAULT_SPEED * 3.5);
        animateAmplitude(DEFAULT_AMPLITUDE * 0.45, DEFAULT_TRANSITION);
        animateFrequency(DEFAULT_FREQUENCY * 3.2, DEFAULT_TRANSITION);
        animateOpacity([1.0, 0.4], {
          duration: 0.4,
          repeat: Infinity,
          repeatType: 'mirror',
        });
        return;
      case 'speaking':
      default:
        setSpeed(DEFAULT_SPEED * 2);
        animateAmplitude(DEFAULT_AMPLITUDE * 1.3, DEFAULT_TRANSITION);
        animateFrequency(DEFAULT_FREQUENCY * 1.2, DEFAULT_TRANSITION);
        animateOpacity(1.0, DEFAULT_TRANSITION);
        return;
    }
  }, [state, setSpeed, animateAmplitude, animateFrequency, animateOpacity]);

  useEffect(() => {
    if (state === 'speaking') {
      animateAmplitude(0.06 + 0.32 * volume, { duration: 0 });
      animateFrequency(14 + 45 * volume, { duration: 0 });
    }
  }, [state, volume, animateAmplitude, animateFrequency]);

  return {
    speed,
    amplitude,
    frequency,
    opacity,
  };
}
