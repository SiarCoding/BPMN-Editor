import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Diagram } from "db/schema";
import { translations } from "../lib/translations";
import { useToast } from "@/hooks/use-toast";

interface ToolbarProps {
  currentDiagram: Diagram | null;
  diagrams: Diagram[];
  onDiagramSelect: (diagram: Diagram | null) => void;
}

export function Toolbar({
  currentDiagram,
  diagrams,
  onDiagramSelect,
}: ToolbarProps) {
  const { toast } = useToast();

  const handleNew = () => {
    try {
      onDiagramSelect(null);
    } catch (error) {
      console.error("Error creating new diagram:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Erstellen eines neuen Diagramms",
        variant: "destructive",
      });
    }
  };

  const handleDiagramSelect = (value: string) => {
    try {
      const selected = diagrams.find((d) => d.id.toString() === value);
      if (!selected) {
        throw new Error("Selected diagram not found");
      }
      onDiagramSelect(selected);
    } catch (error) {
      console.error("Error selecting diagram:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Auswählen des Diagramms",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="border-b p-4 flex items-center space-x-4">
      <Button onClick={handleNew}>{translations.new}</Button>
      
      <Select
        value={currentDiagram?.id?.toString() || ""}
        onValueChange={handleDiagramSelect}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={translations.selectDiagram}>
            {currentDiagram?.name || translations.selectDiagram}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {diagrams.map((diagram) => (
            <SelectItem key={diagram.id} value={diagram.id.toString()}>
              {diagram.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
