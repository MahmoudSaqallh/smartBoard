"use client";

import Konva from "konva";
import { useEffect, useRef, type RefObject } from "react";
import { Transformer } from "react-konva";
import { useBoardStore } from "../store/board-store";
import type { BoardElement } from "../types";
import { INSERTED_TYPES, type TransformSnapshot } from "../utils/elements";

interface SelectionTransformerProps {
  /** Nodes are looked up across all layers (static content and live widgets). */
  stageRef: RefObject<Konva.Stage | null>;
  selectedIds: string[];
  elements: BoardElement[];
  coarsePointer: boolean;
  canEdit: boolean;
}

const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
const ACCENT = "#2952e3";

function snapshotNode(node: Konva.Node): TransformSnapshot {
  return {
    x: node.x(),
    y: node.y(),
    rotation: node.rotation(),
    scaleX: node.scaleX(),
    scaleY: node.scaleY(),
    width: node.width(),
    height: node.height(),
    fontSize: node instanceof Konva.Text ? node.fontSize() : undefined,
  };
}

const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];

export function SelectionTransformer({ stageRef, selectedIds, elements, coarsePointer, canEdit }: SelectionTransformerProps) {
  const transformerRef = useRef<Konva.Transformer>(null);

  // Re-attach whenever the selection or the underlying nodes change
  // (undo, page switch and deletion all replace nodes).
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const ids = new Set(selectedIds);
    const nodes = ids.size ? stage.find((node: Konva.Node) => node.hasName("element") && ids.has(node.id())) : [];
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [stageRef, selectedIds, elements]);

  const selected = elements.filter((el) => selectedIds.includes(el.id));
  const onlyText = selected.length === 1 && selected[0].type === "text";
  // Images, QR codes and widgets never distort: corner handles only, ratio kept.
  const ratioLocked = selected.some((el) => INSERTED_TYPES.has(el.type));
  // Selection stays visible for locked or read-only content, but handles are disabled.
  const transformable = canEdit && !selected.some((el) => el.locked);

  const handleTransformEnd = () => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const snapshots: Record<string, TransformSnapshot> = {};
    for (const node of transformer.nodes()) {
      snapshots[node.id()] = snapshotNode(node);
      // Scale is baked into element geometry; reset it so it never compounds.
      node.scale({ x: 1, y: 1 });
    }
    useBoardStore.getState().transformElements(snapshots);
  };

  return (
    <Transformer
      ref={transformerRef}
      resizeEnabled={transformable}
      rotateEnabled={transformable}
      rotationSnaps={ROTATION_SNAPS}
      rotationSnapTolerance={6}
      flipEnabled={false}
      keepRatio={onlyText || ratioLocked}
      enabledAnchors={ratioLocked ? CORNERS : undefined}
      ignoreStroke
      padding={4}
      anchorSize={coarsePointer ? 14 : 9}
      anchorCornerRadius={2}
      anchorStroke={ACCENT}
      anchorFill="#ffffff"
      borderStroke={transformable ? ACCENT : "#6b6b76"}
      borderStrokeWidth={1.25}
      // Dashed, neutral outline: selected but not movable (locked or read-only).
      borderDash={transformable ? undefined : [4, 3]}
      rotateAnchorOffset={coarsePointer ? 32 : 24}
      boundBoxFunc={(oldBox, newBox) => {
        // Reject only shrinking below the minimum, so thin shapes such as
        // horizontal lines remain resizable along their length.
        const tooNarrow = Math.abs(newBox.width) < 8 && Math.abs(newBox.width) < Math.abs(oldBox.width);
        const tooShort = Math.abs(newBox.height) < 8 && Math.abs(newBox.height) < Math.abs(oldBox.height);
        return tooNarrow || tooShort ? oldBox : newBox;
      }}
      onTransformEnd={handleTransformEnd}
    />
  );
}
