import { useEffect, useRef, useState } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Diagram, DiagramVersion } from "../../db/schema";
import { translations } from "../lib/translations";
import useSWR from "swr";

const emptyBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_1" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="102" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

interface BpmnEditorProps {
  diagram: Diagram | null;
  onSave: (diagram: Partial<Diagram>, comment?: string) => void;
}

export function BpmnEditor({ diagram, onSave }: BpmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<any>(null);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [comment, setComment] = useState("");

  const { data: versions } = useSWR<DiagramVersion[]>(
    diagram ? `/api/diagrams/${diagram.id}/versions` : null
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const modeler = new BpmnModeler({
      container: containerRef.current,
      connectionRouting: {
        layoutConnectionsOnCreate: true,
        manhattan: true
      },
      grid: {
        visible: false
      },
      snapToGrid: true
    });
    
    modelerRef.current = modeler;

    const loadDiagram = async () => {
      try {
        await modeler.importXML(diagram?.bpmnXml || emptyBpmn);
      } catch (err) {
        console.error('Error loading diagram:', err);
      }
    };
    
    loadDiagram();

    return () => {
      modeler.destroy();
    };
  }, []);

  useEffect(() => {
    if (!modelerRef.current || !diagram?.bpmnXml) return;
    
    const loadDiagram = async () => {
      try {
        await modelerRef.current.importXML(diagram.bpmnXml);
      } catch (err) {
        console.error('Error loading diagram:', err);
      }
    };
    
    loadDiagram();
  }, [diagram]);

  const handleSave = async () => {
    if (!modelerRef.current) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const canvas = modelerRef.current.get('canvas');
      const viewbox = canvas.viewbox();
      
      onSave({
        ...diagram,
        bpmnXml: xml,
        flowData: JSON.stringify(viewbox),
        name: diagram?.name || 'Neues Diagramm',
        description: diagram?.description || 'Ein BPMN-Prozessdiagramm',
      }, comment);

      setComment("");
      setShowVersionDialog(false);
    } catch (err) {
      console.error('Error saving diagram:', err);
    }
  };

  const loadVersion = async (versionId: string) => {
    try {
      const response = await fetch(`/api/diagrams/${diagram?.id}/versions/${versionId}`);
      const version = await response.json();
      
      if (modelerRef.current) {
        await modelerRef.current.importXML(version.bpmnXml);
      }
    } catch (err) {
      console.error('Error loading version:', err);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <div className="flex items-center gap-4">
          {diagram && versions && (
            <Select
              value={selectedVersion}
              onValueChange={(value) => {
                setSelectedVersion(value);
                loadVersion(value);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={translations.selectVersion} />
              </SelectTrigger>
              <SelectContent>
                {versions.map((version) => (
                  <SelectItem key={version.version} value={version.version.toString()}>
                    {translations.version} {version.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={() => setShowVersionDialog(true)}>
          {translations.save}
        </Button>
      </div>
      <div ref={containerRef} className="flex-1" />

      <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{translations.saveVersion}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder={translations.versionComment}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button onClick={handleSave}>{translations.save}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
