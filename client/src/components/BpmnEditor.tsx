import { useEffect, useRef } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import { Button } from "@/components/ui/button";
import { Diagram } from "../../db/schema";
import { translations } from "../lib/translations";

// Default empty BPMN diagram
const emptyBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
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
  onSave: (diagram: Partial<Diagram>) => void;
}

export function BpmnEditor({ diagram, onSave }: BpmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize BPMN modeler
    const modeler = new BpmnModeler({
      container: containerRef.current,
      keyboard: {
        bindTo: document,
      },
    });
    modelerRef.current = modeler;

    // Load initial diagram
    modeler.importXML(diagram?.bpmnXml || emptyBpmn);

    return () => {
      modeler.destroy();
    };
  }, []);

  useEffect(() => {
    if (!modelerRef.current || !diagram?.bpmnXml) return;
    modelerRef.current.importXML(diagram.bpmnXml);
  }, [diagram]);

  const handleSave = async () => {
    if (!modelerRef.current) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const flowData = JSON.stringify(await modelerRef.current.get('canvas').getViewbox());
      
      onSave({
        ...diagram,
        bpmnXml: xml,
        flowData,
        name: diagram?.name || 'Neues Diagramm',
        description: diagram?.description || 'Ein BPMN-Prozessdiagramm',
      });
    } catch (err) {
      console.error('Error saving diagram:', err);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col">
      <div className="p-4 border-b flex justify-end">
        <Button onClick={handleSave}>
          {translations.save}
        </Button>
      </div>
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
