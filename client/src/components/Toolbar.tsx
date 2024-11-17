import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Diagram } from "../../db/schema";
import { translations } from "../lib/translations";

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
  const handleNew = () => {
    onDiagramSelect(null);
  };

  return (
    <div className="border-b p-4 flex items-center space-x-4">
      <Button onClick={handleNew}>{translations.new}</Button>
      
      <Select
        value={currentDiagram?.id?.toString()}
        onValueChange={(value) => {
          const selected = diagrams.find((d) => d.id.toString() === value);
          onDiagramSelect(selected || null);
        }}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={translations.selectDiagram} />
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
