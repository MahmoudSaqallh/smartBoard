"use client";

import gsap from "gsap";
import type Konva from "konva";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Group, Rect, Text } from "react-konva";
import { prefersReducedMotion } from "@/lib/hooks/useMediaQuery";
import type { CommonNodeProps } from "../components/node-props";
import { CANVAS_FONT_FAMILY } from "../constants";
import type { TimerElement } from "../types";
import { useTimerRuntimeFor } from "./runtime-store";
import { subscribeTick } from "./ticker";
import { elapsedMs, formatDuration, remainingMs, type TimerRuntime } from "./time";

const DANGER = "#b42318";
const MUTED = "#6b6b76";

const STATUS_TEXT: Record<TimerRuntime["status"], string> = {
  idle: "Ready",
  running: "Running",
  paused: "Paused",
  done: "Time's up",
};

function display(element: TimerElement, runtime: TimerRuntime, now: number): string {
  return element.mode === "countdown"
    ? formatDuration(remainingMs(element.durationMs, runtime, now), { roundUp: true })
    : formatDuration(elapsedMs(runtime, now), { tenths: true });
}

/**
 * Timer/stopwatch face. React re-renders only on status changes (start,
 * pause, finish); the ticking digits are written straight to the Konva text
 * node, and only while running.
 */
export function TimerNode({ element, common }: { element: TimerElement; common: CommonNodeProps }) {
  const runtime = useTimerRuntimeFor(element.id);
  const timeRef = useRef<Konva.Text>(null);
  const pulseRef = useRef<Konva.Group>(null);
  const previousStatus = useRef(runtime.status);
  const { width: w, height: h, color } = element;
  const done = runtime.status === "done";

  useLayoutEffect(() => {
    const update = (now: number) => {
      const node = timeRef.current;
      const text = display(element, runtime, now);
      if (node && node.text() !== text) {
        node.text(text);
        node.getLayer()?.batchDraw();
      }
    };
    if (runtime.status === "running") return subscribeTick(update);
    update(Date.now());
  }, [element, runtime]);

  // One gentle pulse when a countdown finishes; no looping animation on the board.
  useEffect(() => {
    const finishedNow = previousStatus.current !== "done" && runtime.status === "done";
    previousStatus.current = runtime.status;
    const group = pulseRef.current;
    if (!finishedNow || !group || prefersReducedMotion()) return;
    const tween = gsap.fromTo(
      group,
      { scaleX: 1, scaleY: 1 },
      {
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 0.18,
        yoyo: true,
        repeat: 3,
        ease: "power1.inOut",
        onUpdate: () => group.getLayer()?.batchDraw(),
      },
    );
    return () => {
      tween.kill();
      group.scale({ x: 1, y: 1 });
    };
  }, [runtime.status]);

  const title = element.label.trim() || (element.mode === "countdown" ? "Timer" : "Stopwatch");

  return (
    <Group {...common} width={w} height={h}>
      {/* Inner group scales around the centre for the completion pulse. */}
      <Group ref={pulseRef} x={w / 2} y={h / 2} offsetX={w / 2} offsetY={h / 2}>
        <Rect
          width={w}
          height={h}
          fill={done ? "#fef3f2" : "#ffffff"}
          stroke={done ? DANGER : "#e3e3e6"}
          strokeWidth={done ? 2 : 1}
          strokeScaleEnabled={false}
          cornerRadius={Math.min(12, h * 0.1)}
        />
        <Text
          y={h * 0.08}
          width={w}
          height={h * 0.16}
          align="center"
          verticalAlign="middle"
          text={title}
          fontSize={h * 0.12}
          fontStyle="600"
          fontFamily={CANVAS_FONT_FAMILY}
          fill={MUTED}
          wrap="none"
          ellipsis
          padding={4}
          listening={false}
        />
        <Text
          ref={timeRef}
          y={h * 0.24}
          width={w}
          height={h * 0.48}
          align="center"
          verticalAlign="middle"
          fontSize={Math.min(h * 0.4, w / 6.2)}
          fontStyle="600"
          fontFamily={CANVAS_FONT_FAMILY}
          fill={done ? DANGER : color}
          listening={false}
        />
        {/* Status is spelled out, so it never depends on colour alone. */}
        <Text
          y={h * 0.74}
          width={w}
          height={h * 0.16}
          align="center"
          verticalAlign="middle"
          text={STATUS_TEXT[runtime.status]}
          fontSize={h * 0.11}
          fontStyle={done ? "600" : "normal"}
          fontFamily={CANVAS_FONT_FAMILY}
          fill={done ? DANGER : MUTED}
          listening={false}
        />
      </Group>
    </Group>
  );
}
