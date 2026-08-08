import React from 'react';
import Svg, { Rect, Circle, Path, Line, G } from 'react-native-svg';
import {
  COURT_WIDTH_FT, COURT_DEPTH_FT, HOOP_X, HOOP_Y,
  LANE_HALF_FT, FT_LINE_FT, THREE_PT_FT, Spot, Shot,
} from '../hooks/trainingStats';

// Half court drawn from the real dimensions in trainingStats, so the
// markings and the stat geometry can never drift apart. Everything is
// laid out in normalised court space and scaled once, here.

const LINE = '#5A4210';
const FLOOR = '#140A01';
const HOOP = '#8B6914';

/**
 * How much of the floor to show, in feet from the baseline. Everything a
 * shooter uses lives inside ~26ft (the arc tops out at 25), so drawing the
 * full 47ft half court wastes half the frame and shrinks the targets.
 */
export const DEFAULT_VISIBLE_DEPTH_FT = 32;

export interface CourtProps {
  width: number;
  visibleDepthFt?: number;
  /** Spots to draw as targets — drill steps, typically. */
  spots?: Spot[];
  /** Index into `spots` that is currently active (pulsing ring). */
  activeSpotId?: string;
  /** Spots already finished, drawn filled. */
  completedSpotIds?: string[];
  /** Shots to plot: made filled, missed hollow. */
  shots?: Shot[];
  accent?: string;
  missColor?: string;
  onPressPoint?: (x: number, y: number) => void;
}

export default function Court({
  width,
  visibleDepthFt = DEFAULT_VISIBLE_DEPTH_FT,
  spots = [],
  activeSpotId,
  completedSpotIds = [],
  shots = [],
  accent = '#FF8A1F',
  missColor = '#C25E5E',
  onPressPoint,
}: CourtProps) {
  // Full width (50ft), cropped depth. Feet map to the same pixels on both
  // axes, so the arc stays circular and distances read true.
  const height = width * (visibleDepthFt / COURT_WIDTH_FT);

  // Court space puts y=0 at the baseline; the screen puts y=0 at the top.
  // Flip on the way out so the basket sits at the bottom, the way you'd
  // stand behind the baseline looking in.
  const px = (nx: number) => nx * width;
  const lenX = (f: number) => (f / COURT_WIDTH_FT) * width;
  const lenY = (f: number) => (f / visibleDepthFt) * height;
  const posY = (f: number) => height - lenY(f);
  const py = (ny: number) => posY(ny * COURT_DEPTH_FT);

  const hoopX = px(HOOP_X);
  const hoopY = py(HOOP_Y);
  const laneHalf = lenX(LANE_HALF_FT);
  const ftLineY = posY(FT_LINE_FT);
  const ftCircleR = lenX(6);

  // Three-point arc, swept between the points where it meets the baseline.
  // sweep=1 bulges it up the floor, away from the hoop.
  const r3x = lenX(THREE_PT_FT);
  const r3y = lenY(THREE_PT_FT);
  const arc = `M ${hoopX - r3x} ${hoopY} A ${r3x} ${r3y} 0 0 1 ${hoopX + r3x} ${hoopY}`;

  const dotR = Math.max(4, width * 0.018);
  const spotR = Math.max(6, width * 0.028);

  const handlePress = onPressPoint
    ? (e: any) => {
        const { locationX, locationY } = e.nativeEvent;
        const nx = Math.min(Math.max(locationX / width, 0), 1);
        const fy = (1 - locationY / height) * visibleDepthFt;
        const ny = Math.min(Math.max(fy / COURT_DEPTH_FT, 0), 1);
        onPressPoint(nx, ny);
      }
    : undefined;

  return (
    <Svg width={width} height={height} onPress={handlePress}>
      <Rect x={0} y={0} width={width} height={height} rx={4} fill={FLOOR} stroke={LINE} strokeWidth={1.5} />

      {/* lane, free-throw line and circle */}
      <Rect
        x={hoopX - laneHalf} y={ftLineY}
        width={laneHalf * 2} height={height - ftLineY}
        fill="none" stroke={LINE} strokeWidth={1.5}
      />
      <Circle cx={hoopX} cy={ftLineY} r={ftCircleR} fill="none" stroke={LINE} strokeWidth={1.5} />

      <Path d={arc} fill="none" stroke={LINE} strokeWidth={1.5} />

      {/* backboard and rim */}
      <Line
        x1={hoopX - lenX(3)} y1={posY(4)} x2={hoopX + lenX(3)} y2={posY(4)}
        stroke={HOOP} strokeWidth={2.5}
      />
      <Circle cx={hoopX} cy={hoopY} r={Math.max(3, width * 0.014)} fill="none" stroke={HOOP} strokeWidth={2} />

      {/* drill spots: done = filled, upcoming = hollow, active = ringed */}
      <G>
        {spots.map(s => {
          const done = completedSpotIds.includes(s.id);
          const active = s.id === activeSpotId;
          if (active) {
            return (
              <G key={s.id}>
                <Circle cx={px(s.x)} cy={py(s.y)} r={spotR * 1.55} fill="none" stroke="#FFC93C" strokeWidth={3} />
                <Circle cx={px(s.x)} cy={py(s.y)} r={spotR * 0.8} fill="#FFC93C" />
              </G>
            );
          }
          return (
            <Circle
              key={s.id}
              cx={px(s.x)} cy={py(s.y)} r={spotR}
              fill={done ? accent : 'none'}
              stroke={done ? accent : LINE}
              strokeWidth={2}
            />
          );
        })}
      </G>

      {/* plotted shots */}
      <G>
        {shots.map((s, i) => (
          <Circle
            key={i}
            cx={px(s.x)} cy={py(s.y)} r={dotR}
            fill={s.made ? accent : 'none'}
            stroke={s.made ? accent : missColor}
            strokeWidth={2}
          />
        ))}
      </G>
    </Svg>
  );
}
