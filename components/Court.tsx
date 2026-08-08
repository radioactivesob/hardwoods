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

export interface CourtProps {
  width: number;
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
  spots = [],
  activeSpotId,
  completedSpotIds = [],
  shots = [],
  accent = '#FF8A1F',
  missColor = '#C25E5E',
  onPressPoint,
}: CourtProps) {
  // Court is 50ft x 47ft; keep that ratio so distances read true.
  const height = width * (COURT_DEPTH_FT / COURT_WIDTH_FT);
  const px = (nx: number) => nx * width;
  const py = (ny: number) => ny * height;
  const ftX = (f: number) => px(f / COURT_WIDTH_FT);
  const ftY = (f: number) => py(f / COURT_DEPTH_FT);

  const hoopX = px(HOOP_X);
  const hoopY = py(HOOP_Y);
  const laneHalf = ftX(LANE_HALF_FT);
  const ftLineY = ftY(FT_LINE_FT);
  const ftCircleR = ftX(6);

  // Three-point arc, swept between the points where it meets the baseline.
  const r3x = ftX(THREE_PT_FT);
  const r3y = ftY(THREE_PT_FT);
  const arc = `M ${hoopX - r3x} ${hoopY} A ${r3x} ${r3y} 0 0 1 ${hoopX + r3x} ${hoopY}`;

  const dotR = Math.max(4, width * 0.018);
  const spotR = Math.max(6, width * 0.028);

  const handlePress = onPressPoint
    ? (e: any) => {
        const { locationX, locationY } = e.nativeEvent;
        const nx = Math.min(Math.max(locationX / width, 0), 1);
        const ny = Math.min(Math.max(locationY / height, 0), 1);
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
        x1={hoopX - ftX(3)} y1={ftY(4)} x2={hoopX + ftX(3)} y2={ftY(4)}
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
