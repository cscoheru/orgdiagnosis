declare module 'mermaid' {
  interface MermaidConfig {
    startOnLoad?: boolean;
    theme?: string;
    themeVariables?: Record<string, string>;
    flowchart?: { htmlLabels?: boolean; curve?: string; padding?: number };
  }

  interface RenderResult {
    svg: string;
  }

  const mermaid: {
    initialize(config: MermaidConfig): void;
    render(id: string, code: string): Promise<RenderResult>;
  };

  export default mermaid;
}
