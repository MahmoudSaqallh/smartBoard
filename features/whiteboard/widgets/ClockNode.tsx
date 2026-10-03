"use client";

import type Konva from "konva";
import { useLayoutEffect, useRef, type Ref } from "react";
import { Circle, Group, Line, Rect, Text } from "react-konva";
import type { CommonNodeProps } from "../components/node-props";
import { CANVAS_FONT_FAMILY } from "../constants";
import type { ClockElement } from "../types";
import { formatClockDate, formatClockTime, handAngles } from "./clock";
import { subscribeTick } from "./ticker";

const CARD_FILL = "#ffffff";
const CARD_STROKE = "#e3e3e6";
const MUTED = "#6b6b76";

/** Writes text only when it changed; returns whether a redraw is needed. */
function setText(node: Konva.Text | null, value: string): boolean {
  if (!node || node.text() === value) return false;
  node.text(value);
  return true;
}

function DigitalClock({ element, common }: { element: ClockElement; common: CommonNodeProps }) {
  const timeRef = useRef<Konva.Text>(null);
  const dateRef = useRef<Konva.Text>(null);
  const { width: w, height: h, hour12, showSeconds, showDate, color } = element;

  useLayoutEffect(
    () =>
      subscribeTick((now) => {
        const date = new Date(now);
        const { time, period } = formatClockTime(date, { hour12, showSeconds });
        const changed = setText(timeRef.current, period ? `${time} ${period}` : time);
        const dateChanged = showDate && setText(dateRef.current, formatClockDate(date));
        if (changed || dateChanged) timeRef.current?.getLayer()?.batchDraw();
      }),
    [hour12, showSeconds, showDate],
  );

  // Fit the widest possible string for this format into the card.
  const sample = `${hour12 ? "12:00" : "00:00"}${showSeconds ? ":00" : ""}${hour12 ? " PM" : ""}`;
  const timeSize = Math.min(h * (showDate ? 0.42 : 0.5), (w * 0.9) / (sample.length * 0.6));

  return (
    <Group {...common} width={w} height={h}>
      <Rect width={w} height={h} fill={CARD_FILL} stroke={CARD_STROKE} strokeWidth={1} strokeScaleEnabled={false} cornerRadius={Math.min(12, h * 0.12)} />
      <Text
        ref={timeRef}
        y={showDate ? h * 0.1 : 0}
        width={w}
        height={showDate ? h * 0.56 : h}
        align="center"
        verticalAlign="middle"
        fontSize={timeSize}
        fontStyle="600"
        fontFamily={CANVAS_FONT_FAMILY}
        fill={color}
        listening={false}
      />
      {showDate && (
        <Text
          ref={dateRef}
          y={h * 0.64}
          width={w}
          height={h * 0.26}
          align="center"
          verticalAlign="top"
          fontSize={h * 0.16}
          fontFamily={CANVAS_FONT_FAMILY}
          fill={MUTED}
          listening={false}
        />
      )}
    </Group>
  );
}

/** A clock hand pivoting on the face centre; rotation is set imperatively by the ticker. */
function Hand({ ref, r, length, width, stroke }: { ref: Ref<Konva.Line>; r: number; length: number; width: number; stroke: string }) {
  return <Line ref={ref} x={r} y={r} points={[0, r * 0.12, 0, -length]} stroke={stroke} strokeWidth={width} lineCap="round" listening={false} />;
}

function AnalogClock({ element, common }: { element: ClockElement; common: CommonNodeProps }) {
  const hourRef = useRef<Konva.Line>(null);
  const minuteRef = useRef<Konva.Line>(null);
  const secondRef = useRef<Konva.Line>(null);
  const { width: w, height: h, showSeconds, color } = element;
  const r = Math.min(w, h) / 2;

  useLayoutEffect(
    () =>
      subscribeTick((now) => {
        const angles = handAngles(new Date(now));
        let changed = false;
        const turn = (node: Konva.Line | null, angle: number) => {
          if (node && node.rotation() !== angle) {
            node.rotation(angle);
            changed = true;
          }
        };
        turn(hourRef.current, angles.hour);
        turn(minuteRef.current, angles.minute);
        if (showSeconds) turn(secondRef.current, angles.second);
        if (changed) hourRef.current?.getLayer()?.batchDraw();
      }),
    [showSeconds],
  );

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * Math.PI) / 6;
    const major = i % 3 === 0;
    const inner = r * (major ? 0.76 : 0.82);
    const outer = r * 0.9;
    return (
      <Line
        key={i}
        points={[r + Math.sin(angle) * inner, r - Math.cos(angle) * inner, r + Math.sin(angle) * outer, r - Math.cos(angle) * outer]}
        stroke={major ? color : MUTED}
        strokeWidth={r * (major ? 0.04 : 0.022)}
        lineCap="round"
        listening={false}
      />
    );
  });

  return (
    <Group {...common} width={r * 2} height={r * 2}>
      <Circle x={r} y={r} radius={r} fill={CARD_FILL} stroke={CARD_STROKE} strokeWidth={1} strokeScaleEnabled={false} />
      {ticks}
      <Hand ref={hourRef} r={r} length={r * 0.5} width={r * 0.075} stroke={color} />
      <Hand ref={minuteRef} r={r} length={r * 0.72} width={r * 0.048} stroke={color} />
      {showSeconds && <Hand ref={secondRef} r={r} length={r * 0.8} width={r * 0.02} stroke="#d92d20" />}
      <Circle x={r} y={r} radius={r * 0.055} fill={showSeconds ? "#d92d20" : color} listening={false} />
    </Group>
  );
}

export function ClockNode({ element, common }: { element: ClockElement; common: CommonNodeProps }) {
  return element.variant === "analog" ? (
    <AnalogClock element={element} common={common} />
  ) : (
    <DigitalClock element={element} common={common} />
  );
}
