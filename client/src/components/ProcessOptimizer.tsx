// ProcessOptimizer.tsx
import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Diagram } from "db/schema";
import { translations } from "../lib/translations";
import { analyzeBPMNProcess } from "../lib/openai";
import { Spinner } from "./ui/spinner";
import { useToast } from "@/hooks/use-toast";

interface ProcessOptimizerProps {
  /**
   * Das aktuell ausgewählte Diagramm (IST-Zustand).
   */
  diagram: Diagram | null;
  /**
   * Callback, um das neue optimierte Diagramm (SOLL-Zustand) weiterzureichen.
   */
  onOptimizedDiagram: (diagram: Diagram) => void;
}

/**
 * Struktur der Optimierungs-Antwort aus der KI:
 * - vorschlaege: Array mit Verbesserungsvorschlägen
 * - optimized_bpmn: das erzeugte BPMN-XML
 */
interface OptimizationResult {
  vorschlaege: string[];
  optimized_bpmn: string;
}

/**
 * Komponente für die Prozessoptimierung mittels KI.
 * Ruft analyzeBPMNProcess auf und erzeugt ein neues (optimiertes) Diagramm.
 */
export function ProcessOptimizer({ diagram, onOptimizedDiagram }: ProcessOptimizerProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    console.log("Current diagram:", diagram);
  }, [diagram]);

  /**
   * Klick auf "Prozess optimieren"
   */
  const handleOptimize = async () => {
    if (!diagram?.bpmnXml) {
      setError("Kein Diagramm ausgewählt");
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie zuerst ein Diagramm aus.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("Starting optimization for diagram:", diagram.name);
      console.log("BPMN XML length:", diagram.bpmnXml.length);

      // KI-Aufruf
      const result = await analyzeBPMNProcess(diagram.bpmnXml);
      console.log("Optimization result received:", result);

      // Grundvalidierung
      if (!result.optimized_bpmn || !result.vorschlaege) {
        throw new Error("Ungültige Optimierungsantwort");
      }

      // Prüfen, ob das BPMN sinnvolle Strukturen enthält
      if (
        !result.optimized_bpmn.includes("<?xml") ||
        !result.optimized_bpmn.includes("bpmn:definitions")
      ) {
        console.error(
          "Invalid BPMN XML received:",
          result.optimized_bpmn.substring(0, 100) + "..."
        );
        throw new Error("Ungültiges BPMN XML Format");
      }

      // Bereinigen des XML
      const cleanedXml = result.optimized_bpmn
        .trim()
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .replace(/^\s*<\?xml/, "<?xml"); // Entferne Whitespace vor XML-Deklaration

      console.log("Cleaned XML length:", cleanedXml.length);

      // Letzte Prüfung
      if (!cleanedXml.startsWith("<?xml")) {
        throw new Error("Bereinigtes XML ist ungültig");
      }

      // Neues Diagramm (SOLL-Zustand) erstellen
      const optimizedDiagram: Diagram = {
        id: -1, // Temporäre ID
        name: `${diagram.name} (Optimiert)`,
        description: `Optimierte Version von: ${diagram.name}`,
        bpmnXml: cleanedXml,
        flowData: diagram.flowData,
        optimizationSuggestions: result.vorschlaege,
        currentVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log("Created optimized diagram object:", optimizedDiagram);
      onOptimizedDiagram(optimizedDiagram);

      // Lokale Analysis speichern (zur Anzeige der Vorschläge)
      setAnalysis(result);

      toast({
        title: "Optimierung erfolgreich",
        description: "Der SOLL-Zustand wurde erfolgreich erstellt.",
      });
    } catch (err) {
      console.error("Optimization error:", err);
      const errorMessage = err instanceof Error ? err.message : "Fehler bei der Prozessoptimierung";
      setError(errorMessage);
      toast({
        title: "Optimierung fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      });
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
            "Prozess optimieren"
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
