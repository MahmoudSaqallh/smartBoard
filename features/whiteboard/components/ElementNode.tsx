"use client";

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { memo } from "react";
import { Ellipse, Group, Line, Rect, Text } from "react-konva";
import {
  CANVAS_FONT_FAMILY,
  MIN_ELEMENT_SIZE,
  STICKY_FONT_SIZE,
  STICKY_PADDING,
  STICKY_TEXT_COLOR,
  TEXT_LINE_HEIGHT,
} from "../constants";
import { useBoardStore } from "../store/board-store";
import type { BoardElement } from "../types";
import { hexToRgba } from "../utils/elements";
import { ClockNode } from "../widgets/ClockNode";
import { TimerNode } from "../widgets/TimerNode";
import { ImageNode } from "./ImageNode";
import type { CommonNodeProps } from "./node-props";
import { QrNode } from "./QrNode";

interface ElementNodeProps {
  element: BoardElement;
  draggable?: boolean;
  /** Marked for erasing; shown faded until the gesture ends. */
  faded?: boolean;
  /** Hidden while its text is edited in the HTML overlay. */
  hidden?: boolean;
  listening?: boolean;
}

// Nodes moved together by the Transformer fire their dragstart in the same
// tick; grouping by start time merges their dragend commits into one undo step.
let dragGesture = 0;
let lastDragStart = 0;

function handleDragStart() {
  const now = performance.now();
  if (now - lastDragStart > 50) dragGesture += 1;
  lastDragStart = now;
}

function handleDragEnd(event: KonvaEventObject<DragEvent>) {
  const node = event.target;
  useBoardStore.getState().transformElements(
    { [node.id()]: { x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: 1, scaleY: 1 } },
    `drag:${dragGesture}`,
  );
}

/** Text reflows while resizing instead of stretching. */
function handleTextTransform(event: KonvaEventObject<Event>) {
  const node = event.currentTarget as Konva.Text;
  node.setAttrs({
    width: Math.max(MIN_ELEMENT_SIZE * 4, node.width() * node.scaleX()),
    fontSize: Math.max(6, node.fontSize() * node.scaleY()),
    scaleX: 1,
    scaleY: 1,
  });
}

/** Sticky notes resize their background and text box instead of scaling the text. */
function handleStickyTransform(event: KonvaEventObject<Event>) {
  const group = event.currentTarget as Konva.Group;
  const width = Math.max(MIN_ELEMENT_SIZE * 8, group.width() * group.scaleX());
  const height = Math.max(MIN_ELEMENT_SIZE * 8, group.height() * group.scaleY());
  group.setAttrs({ width, height, scaleX: 1, scaleY: 1 });
  group.findOne<Konva.Rect>("Rect")?.size({ width, height });
  group.findOne<Konva.Text>("Text")?.size({
    width: width - STICKY_PADDING * 2,
    height: height - STICKY_PADDING * 2,
  });
}

export const ElementNode = memo(function ElementNode({
  element,
  draggable = false,
  faded = false,
  hidden = false,
  listening = true,
}: ElementNodeProps) {
  const common: CommonNodeProps = {
    id: element.id,
    name: "element",
    x: element.x,
    y: element.y,
    rotation: element.rotation,
    draggable,
    listening,
    visible: !hidden,
    opacity: faded ? 0.25 : 1,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
  };

  switch (element.type) {
    case "image":
      return <ImageNode element={element} common={common} />;
    case "qr":
      return <QrNode element={element} common={common} />;
    case "clock":
      return <ClockNode element={element} common={common} />;
    case "timer":
      return <TimerNode element={element} common={common} />;
    case "freehand":
    case "line":
      return (
        <Line
          {...common}
          points={element.points}
          stroke={element.color}
          strokeWidth={element.strokeWidth}
          hitStrokeWidth={Math.max(element.strokeWidth, 16)}
          lineCap="round"
          lineJoin="round"
          strokeScaleEnabled={false}
          perfectDrawEnabled={false}
        />
      );

    case "rectangle":
      return (
        <Rect
          {...common}
          width={element.width}
          height={element.height}
          stroke={element.color}
          strokeWidth={element.strokeWidth}
          // A transparent fill keeps outlined shapes selectable by their interior.
          fill={element.filled ? hexToRgba(element.color, 0.16) : "rgba(0,0,0,0)"}
          cornerRadius={2}
          strokeScaleEnabled={false}
          perfectDrawEnabled={false}
        />
      );

    case "ellipse":
      return (
        <Ellipse
          {...common}
          radiusX={element.radiusX}
          radiusY={element.radiusY}
          stroke={element.color}
          strokeWidth={element.strokeWidth}
          fill={element.filled ? hexToRgba(element.color, 0.16) : "rgba(0,0,0,0)"}
          strokeScaleEnabled={false}
          perfectDrawEnabled={false}
        />
      );

    case "text":
      return (
        <Text
          {...common}
          text={element.text}
          width={element.width}
          fontSize={element.fontSize}
          fontFamily={CANVAS_FONT_FAMILY}
          lineHeight={TEXT_LINE_HEIGHT}
          fill={element.color}
          wrap="word"
          onTransform={handleTextTransform}
        />
      );

    case "sticky":
      return (
        <Group {...common} width={element.width} height={element.height} onTransform={handleStickyTransform}>
          <Rect
            width={element.width}
            height={element.height}
            fill={element.color}
            cornerRadius={3}
            shadowColor="#101018"
            shadowOpacity={0.14}
            shadowBlur={8}
            shadowOffsetY={2}
            shadowForStrokeEnabled={false}
            perfectDrawEnabled={false}
          />
          <Text
            x={STICKY_PADDING}
            y={STICKY_PADDING}
            width={element.width - STICKY_PADDING * 2}
            height={element.height - STICKY_PADDING * 2}
            text={element.text}
            fontSize={STICKY_FONT_SIZE}
            fontFamily={CANVAS_FONT_FAMILY}
            lineHeight={TEXT_LINE_HEIGHT}
            fill={STICKY_TEXT_COLOR}
            wrap="word"
            ellipsis
          />
        </Group>
      );
  }
});

interface ElementsListProps {
  elements: BoardElement[];
  draggable: boolean;
  editingId: string | null;
  erasingIds: ReadonlySet<string>;
}

/** Memoised so pointer-driven re-renders (drafts, panning) skip unchanged elements. */
export const ElementsList = memo(function ElementsList({ elements, draggable, editingId, erasingIds }: ElementsListProps) {
  return elements.map((element) => (
    <ElementNode
      key={element.id}
      element={element}
      // Konva moves nodes itself, so locked elements must not be draggable at all;
      // a rejected drag would otherwise leave the node visually displaced.
      draggable={draggable && !element.locked}
      hidden={element.id === editingId}
      faded={erasingIds.has(element.id)}
    />
  ));
});
