import { useEffect, useState } from "react";
import { Diagram } from "db/schema";
import { BpmnEditor } from "../components/BpmnEditor";
import { Toolbar } from "../components/Toolbar";
import { ProcessOptimizer } from "../components/ProcessOptimizer";
import useSWR, { mutate } from "swr";
import { useToast } from "@/hooks/use-toast";

export default function Editor() {
  const [currentDiagram, setCurrentDiagram] = useState<Diagram | null>(null);
  const [optimizedDiagram, setOptimizedDiagram] = useState<Diagram | null>(null);
  const { data: diagrams, error: diagramsError } = useSWR<Diagram[]>("/api/diagrams");
  const { toast } = useToast();

  const handleSave = async (diagram: Partial<Diagram>, comment?: string) => {
    try {
      let response;
      let responseData;

      if (currentDiagram?.id) {
        console.log("Updating diagram:", currentDiagram.id);
        response = await fetch(`/api/diagrams/${currentDiagram.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...diagram, comment }),
        });
      } else {
        console.log("Creating new diagram");
        response = await fetch("/api/diagrams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(diagram),
        });
      }

      if (!response.ok) {
        console.error("Save failed:", response.status, response.statusText);
        throw new Error(`Save failed: ${response.statusText}`);
      }

      responseData = await response.json();
      console.log("Save response:", responseData);

      if (!responseData || !responseData.id) {
        console.error("Invalid response data:", responseData);
        throw new Error("Invalid response data");
      }

      setCurrentDiagram(responseData);
      setOptimizedDiagram(null); // Reset optimized diagram when saving
      
      await Promise.all([
        mutate("/api/diagrams"),
        currentDiagram?.id && mutate(`/api/diagrams/${currentDiagram.id}/versions`),
      ]);

      toast({
        title: currentDiagram?.id ? "Gespeichert" : "Erstellt",
        description: currentDiagram?.id 
          ? "Das Diagramm wurde erfolgreich gespeichert."
          : "Das neue Diagramm wurde erstellt.",
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Fehler",
        description: "Beim Speichern ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (diagramsError) {
      console.error("Error loading diagrams:", diagramsError);
      toast({
        title: "Fehler",
        description: "Fehler beim Laden der Diagramme.",
        variant: "destructive",
      });
    }
  }, [diagramsError, toast]);

  const handleOptimizedDiagram = (diagram: Diagram) => {
    setOptimizedDiagram(diagram);
  };

  return (
    <div className="flex h-screen flex-col">
      <Toolbar
        currentDiagram={currentDiagram}
        diagrams={diagrams || []}
        onDiagramSelect={(diagram) => {
          setCurrentDiagram(diagram);
          setOptimizedDiagram(null);
        }}
      />
      <div className="flex flex-1 gap-4 p-4 bg-gray-50">
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm">
          <div className="p-2 border-b bg-gray-50">
            <h2 className="text-lg font-semibold">IST-Zustand</h2>
          </div>
          <div className="flex-1">
            <BpmnEditor
              diagram={currentDiagram}
              onSave={handleSave}
            />
          </div>
        </div>
        
        <div className="w-[400px] bg-white rounded-lg shadow-sm overflow-auto">
          <ProcessOptimizer 
            diagram={currentDiagram} 
            onOptimizedDiagram={handleOptimizedDiagram}
          />
        </div>

        {optimizedDiagram && (
          <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm">
            <div className="p-2 border-b bg-gray-50">
              <h2 className="text-lg font-semibold">SOLL-Zustand</h2>
            </div>
            <div className="flex-1">
              <BpmnEditor
                diagram={optimizedDiagram}
                onSave={handleSave}
                readOnly={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
