import type { KonvaEventObject } from "konva/lib/Node";

/** Props every element node receives (identity, transform, interaction). */
export interface CommonNodeProps {
  id: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  draggable: boolean;
  listening: boolean;
  visible: boolean;
  /** 1, or reduced while the eraser hovers the element. */
  opacity: number;
  onDragStart: () => void;
  onDragEnd: (event: KonvaEventObject<DragEvent>) => void;
}
