// ProcessOptimizer.tsx
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Diagram } from "db/schema";
import { translations } from "../lib/translations";
import { BpmnEditor } from "./BpmnEditor";
import { analyzeBPMNProcess } from "../lib/openai";
import { Spinner } from "./ui/spinner";

interface ProcessOptimizerProps {
  diagram: Diagram | null;
  onOptimizedDiagram: (diagram: Diagram) => void;
}

interface OptimizationResult {
  vorschlaege: string[];
  optimized_bpmn: string;
}

export function ProcessOptimizer({ diagram, onOptimizedDiagram }: ProcessOptimizerProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('Current diagram:', diagram);
  }, [diagram]);

  const handleOptimize = async () => {
    if (!diagram?.bpmnXml) {
      setError("Kein Diagramm ausgewählt");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await analyzeBPMNProcess(diagram.bpmnXml);
      console.log('Optimization result:', result);
      
      // Erstelle ein neues Diagramm für den SOLL-Zustand
      const optimizedDiagram: Partial<Diagram> = {
        name: diagram.name + " (Optimiert)",
        description: "Optimierte Version von: " + diagram.name,
        bpmnXml: result.optimized_bpmn,
        flowData: diagram.flowData || {},
        optimizationSuggestions: result.vorschlaege,
        currentVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      onOptimizedDiagram(optimizedDiagram as Diagram);
      setAnalysis(result);
    } catch (err) {
      console.error('Optimization error:', err);
      setError("Fehler bei der Prozessoptimierung");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-white sticky top-0">
        <h2 className="text-xl font-bold mb-4">Prozessoptimierung</h2>
        <Button 
          onClick={handleOptimize}
          disabled={loading || !diagram?.bpmnXml}
          className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg"
        >
          {loading ? (
            <>
              <Spinner className="mr-2" />
              Optimiere Prozess...
            </>
          ) : (
            'Prozess optimieren'
          )}
        </Button>
      </div>

      {error && (
        <div className="p-4 text-red-500 bg-red-50 border-b">
          {error}
        </div>
      )}

      <ScrollArea className="flex-1">
        {analysis && (
          <div className="p-4 space-y-6">
            <section>
              <h3 className="text-lg font-semibold mb-3">Optimierungsvorschläge</h3>
              <div className="space-y-2">
                {analysis.vorschlaege.map((vorschlag, idx) => (
                  <div key={idx} className="bg-blue-50 p-3 rounded">
                    <div className="text-blue-700">{vorschlag}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}