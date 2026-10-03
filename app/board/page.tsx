import type { Metadata } from "next";
import { BoardWorkspace } from "@/components/board/BoardWorkspace";

export const metadata: Metadata = {
  title: "Board",
};

export default function BoardPage() {
  return <BoardWorkspace />;
}
