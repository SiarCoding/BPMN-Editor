import { useEffect, useState } from "react";
import { Diagram } from "../../db/schema";
import { BpmnEditor } from "../components/BpmnEditor";
import { Toolbar } from "../components/Toolbar";
import { ProcessOptimizer } from "../components/ProcessOptimizer";
import useSWR, { mutate } from "swr";
import { useToast } from "@/hooks/use-toast";

export default function Editor() {
  const [currentDiagram, setCurrentDiagram] = useState<Diagram | null>(null);
  const { data: diagrams, error: diagramsError } = useSWR<Diagram[]>("/api/diagrams");
  const { toast } = useToast();

  const handleSave = async (diagram: Partial<Diagram>, comment?: string) => {
    try {
      let response;
      let responseData;

      if (currentDiagram?.id) {
        // Update existing diagram
        console.log("Updating diagram:", currentDiagram.id);
        response = await fetch(`/api/diagrams/${currentDiagram.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...diagram, comment }),
        });
      } else {
        // Create new diagram
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
      
      // Invalidate caches
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

  return (
    <div className="flex h-screen flex-col">
      <Toolbar
        currentDiagram={currentDiagram}
        diagrams={diagrams || []}
        onDiagramSelect={setCurrentDiagram}
      />
      <div className="flex flex-1">
        <BpmnEditor
          diagram={currentDiagram}
          onSave={handleSave}
        />
        <ProcessOptimizer diagram={currentDiagram} />
      </div>
    </div>
  );
}
