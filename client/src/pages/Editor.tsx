import { useEffect, useState } from "react";
import { Diagram } from "../../db/schema";
import { BpmnEditor } from "../components/BpmnEditor";
import { Toolbar } from "../components/Toolbar";
import { ProcessOptimizer } from "../components/ProcessOptimizer";
import useSWR from "swr";
import { useToast } from "@/hooks/use-toast";

export default function Editor() {
  const [currentDiagram, setCurrentDiagram] = useState<Diagram | null>(null);
  const { data: diagrams } = useSWR<Diagram[]>("/api/diagrams");
  const { toast } = useToast();

  const handleSave = async (diagram: Partial<Diagram>) => {
    try {
      if (currentDiagram?.id) {
        await fetch(`/api/diagrams/${currentDiagram.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(diagram),
        });
        toast({
          title: "Gespeichert",
          description: "Das Diagramm wurde erfolgreich gespeichert.",
        });
      } else {
        await fetch("/api/diagrams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(diagram),
        });
        toast({
          title: "Erstellt",
          description: "Das neue Diagramm wurde erstellt.",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Beim Speichern ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    }
  };

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
