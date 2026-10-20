'use client';

import { useMemo, type ComponentProps } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { type AgentState, type TrackReferenceOrPlaceholder } from '@livekit/components-react';

import { ReactShaderToy } from '@/components/agents-ui/react-shader-toy';
import { useAgentAudioVisualizerWave } from '@/hooks/agents-ui/use-agent-audio-visualizer-wave';
import { cn } from '@/lib/utils';
import type { LocalAudioTrack, RemoteAudioTrack } from 'livekit-client';

const DEFAULT_COLOR = '#1FD5F9';

function hexToRgb(hexColor: string) {
  try {
    const rgbColor = hexColor.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);

    if (rgbColor) {
      const [, r, g, b] = rgbColor;
      const color = [r, g, b].map((c = '00') => parseInt(c, 16) / 255);

      return color;
    }
  } catch {
    console.error(
      `Invalid hex color '${hexColor}'.\nFalling back to default color '${DEFAULT_COLOR}'.`,
    );
  }

  return hexToRgb(DEFAULT_COLOR);
}

const shaderSource = `
const float TAU = 6.28318530718;

// Noise for dithering
vec2 randFibo(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.xx + p.yx) * p.xy);
}

// Luma for alpha
float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

// RGB to HSV
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Bell curve function: keeps wave active across full lateral width,
// smoothly anchoring to baseline only at extreme left and right ends.
float bellCurve(float distanceFromCenter, float maxDistance) {
  float normalizedDistance = clamp(distanceFromCenter / maxDistance, 0.0, 1.0);
  return pow(cos(normalizedDistance * (3.14159265359 * 0.5)), 0.55);
}

// Calculate the sine wave
float oscilloscopeWave(float x, float centerX, float time) {
  float relativeX = x - centerX;
  float maxDistance = 0.5;
  float distanceFromCenter = abs(relativeX);

  float bell = bellCurve(distanceFromCenter, maxDistance);

  // Multi-cycle wave spanning full width
  float wave = sin(relativeX * uFrequency + time * uSpeed) * uAmplitude * bell;

  return wave;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;

  float centerX = 0.5;
  float centerY = 0.5;
  float x = uv.x;
  float y = uv.y;

  // Search in true pixel space for isotropic, uniform stroke across any aspect ratio
  float searchRangePixels = max(uLineWidth * 6.0, 28.0);
  float searchRangeUV = searchRangePixels / max(iResolution.x, 1.0);

  const int NUM_SAMPLES = 50;
  float minDistPixels = 10000.0;

  for(int i = 0; i < NUM_SAMPLES; i++) {
    float offsetUV = (float(i) / float(NUM_SAMPLES - 1) - 0.5) * searchRangeUV;
    float sampleX = clamp(x + offsetUV, 0.0, 1.0);
    float waveY = centerY + oscilloscopeWave(sampleX, centerX, iTime);

    vec2 wavePixel = vec2(sampleX * iResolution.x, waveY * iResolution.y);
    float distPixels = distance(fragCoord.xy, wavePixel);

    minDistPixels = min(minDistPixels, distPixels);
  }

  // Smooth line with antialiasing in true pixels
  float radius = uLineWidth * 0.7;
  float smoothing = max(uSmoothing, 0.65);
  float line = smoothstep(radius + smoothing, max(radius - smoothing, 0.0), minDistPixels);

  // Soft atmospheric luminous glow
  float glow = exp(-minDistPixels * 0.35) * 0.32;

  vec3 color = uColor;
  if(abs(uColorShift) > 0.01) {
    float distanceFromCenter = abs(x - centerX);
    float edgeFactor = clamp(distanceFromCenter * 2.0, 0.0, 1.0);
    vec3 hsv = rgb2hsv(color);
    hsv.x = fract(hsv.x + edgeFactor * uColorShift * 0.28);
    color = hsv2rgb(hsv);
  }

  vec3 finalColor = color * (line + glow);
  float alpha = clamp(line + glow * 0.75, 0.0, 1.0) * uMix;

  fragColor = vec4(finalColor * uMix, alpha);
}`;

interface WaveShaderProps {
  /**
   * Class name
   * @default ''
   */
  className?: string;
  /**
   * Speed of the oscilloscope
   * @default 10
   */
  speed?: number;
  /**
   * Amplitude of the oscilloscope
   * @default 0.02
   */
  amplitude?: number;
  /**
   * Frequency of the oscilloscope
   * @default 20.0
   */
  frequency?: number;
  /**
   * Color of the oscilloscope in hexidecimal format.
   * @default '#1FD5F9'
   */
  color?: `#${string}`;
  /**
   * Hue shift amount applied toward the outside of the wave. Center remains at the base color.
   * @default 0.05
   */
  colorShift?: number;
  /**
   * Mix of the oscilloscope
   * @default 1.0
   */
  mix?: number;
  /**
   * Line width of the oscilloscope in pixels
   * @default 2.0
   */
  lineWidth?: number;
  /**
   * Blur of the oscilloscope in pixels
   * @default 0.5
   */
  blur?: number;
}

function WaveShader({
  speed = 10,
  color = '#1FD5F9',
  colorShift = 0.05,
  mix = 1.0,
  amplitude = 0.02,
  frequency = 20.0,
  lineWidth = 2.0,
  blur = 0.5,
  ref,
  className,
  ...props
}: WaveShaderProps & ComponentProps<'div'>) {
  const rgbColor = useMemo(() => hexToRgb(color), [color]);

  return (
    <div ref={ref} className={className} {...props}>
      <ReactShaderToy
        fs={shaderSource}
        devicePixelRatio={globalThis.devicePixelRatio ?? 1}
        uniforms={{
          uSpeed: { type: '1f', value: speed },
          uAmplitude: { type: '1f', value: amplitude },
          uFrequency: { type: '1f', value: frequency },
          uMix: { type: '1f', value: mix },
          uLineWidth: { type: '1f', value: lineWidth },
          uSmoothing: { type: '1f', value: blur },
          uColor: { type: '3fv', value: rgbColor },
          uColorShift: { type: '1f', value: colorShift },
        }}
        onError={(error) => {
          console.error('Shader error:', error);
        }}
        onWarning={(warning) => {
          console.warn('Shader warning:', warning);
        }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

WaveShader.displayName = 'WaveShader';

export const AgentAudioVisualizerWaveVariants = cva([], {
  variants: {
    size: {
      icon: 'h-[24px] aspect-square',
      sm: 'h-[56px] aspect-square',
      md: 'h-[112px] aspect-square',
      lg: 'h-[224px] aspect-square',
      xl: 'h-[448px] aspect-square',
      full: 'w-full h-full',
    },
  },
  defaultVariants: {
    size: 'full',
  },
});

export interface AgentAudioVisualizerWaveProps {
  /**
   * The size of the visualizer.
   * @defaultValue 'full'
   */
  size?: 'icon' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /**
   * The agent state.
   * @defaultValue 'speaking'
   */
  state?: AgentState;
  /**
   * The color of the wave in hexidecimal format.
   * @defaultValue '#1FD5F9'
   */
  color?: `#${string}`;
  /**
   * The color shift of the wave. Higher values increase hue variation toward the edges.
   * @defaultValue 0.05
   */
  colorShift?: number;
  /**
   * The line width of the wave in pixels.
   * @defaultValue 2.0
   */
  lineWidth?: number;
  /**
   * The blur of the wave in pixels.
   * @defaultValue 0.5
   */
  blur?: number;
  /**
   * The audio track to visualize. Can be a local/remote audio track or a track reference.
   */
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder;
  /**
   * Volume value (0-1) to use instead of the value computed from the audioTrack.
   */
  volume?: number;
  /**
   * Additional CSS class names to apply to the container.
   */
  className?: string;
}

/**
 * A wave-style audio visualizer that responds to agent state and audio levels.
 * Displays an animated wave that reacts to the current agent state (connecting, thinking, speaking, etc.)
 * and audio volume when speaking.
 */
export function AgentAudioVisualizerWave({
  size = 'full',
  state = 'speaking',
  color,
  colorShift = 0.05,
  lineWidth,
  blur,
  audioTrack,
  volume,
  className,
  ref,
  ...props
}: AgentAudioVisualizerWaveProps &
  ComponentProps<'div'> &
  VariantProps<typeof AgentAudioVisualizerWaveVariants>) {
  const _lineWidth = useMemo(() => {
    if (lineWidth !== undefined) {
      return lineWidth;
    }
    switch (size) {
      case 'icon':
      case 'sm':
        return 2;
      default:
        return 2;
    }
  }, [lineWidth, size]);

  const { speed, amplitude, frequency, opacity } = useAgentAudioVisualizerWave({
    state,
    audioTrack,
    volume,
  });

  return (
    <WaveShader
      ref={ref}
      data-lk-state={state}
      speed={speed}
      color={color}
      colorShift={colorShift}
      mix={opacity}
      amplitude={amplitude}
      frequency={frequency}
      lineWidth={_lineWidth}
      blur={blur}
      className={cn(
        AgentAudioVisualizerWaveVariants({ size }),
        'mask-[linear-gradient(90deg,transparent_0%,black_3%,black_97%,transparent_100%)]',
        className,
      )}
      {...props}
    />
  );
}
