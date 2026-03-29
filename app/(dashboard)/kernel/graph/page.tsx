import dynamic from "next/dynamic";

/**
 * 交互式图谱查看器 — Server Component wrapper
 *
 * Uses dynamic import with ssr: false to avoid ReactFlow
 * "window is not defined" error during prerendering.
 */

const GraphPageContent = dynamic(
  () => import("./GraphPageContent"),
  { ssr: false }
);

export default function GraphPage() {
  return <GraphPageContent />;
}
