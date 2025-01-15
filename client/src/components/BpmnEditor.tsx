import { useEffect, useRef, useState } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Diagram, DiagramVersion } from "db/schema";
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
  readOnly?: boolean;
}

export function BpmnEditor({ diagram, onSave, readOnly }: BpmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<any>(null);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SWR, um Versions-Liste abzurufen
  const { data: versions } = useSWR<DiagramVersion[]>(
    diagram ? `/api/diagrams/${diagram.id}/versions` : null
  );

  const initializeModeler = async () => {
    if (!containerRef.current || modelerRef.current) return;

    try {
      console.log("Initializing BPMN modeler");

      // Keyboard-Binding explizit entfernen
      const modeler = new BpmnModeler({
        container: containerRef.current,
        additionalModules: [
          {
            contextPadProvider: ["value", {}],
          },
        ],
        moddleExtensions: {
          camunda: {
            name: "Camunda",
            uri: "http://camunda.org/schema/1.0/bpmn",
          },
        },
      });

      modelerRef.current = modeler;

      // Lade initiales BPMN (oder emptyBpmn)
      const xmlToLoad = diagram?.bpmnXml || emptyBpmn;
      console.log("Loading initial diagram:", xmlToLoad.substring(0, 100) + "...");
      await loadDiagram(xmlToLoad);
    } catch (err) {
      console.error("Error initializing modeler:", err);
      setError("Fehler beim Initialisieren des Editors");
    }
  };

  const loadDiagram = async (xml: string) => {
    if (!modelerRef.current) {
      console.error("Modeler not initialized");
      return;
    }

    if (!xml || typeof xml !== "string") {
      console.error("Invalid XML:", xml);
      setError("Ungültiges BPMN-Diagramm");
      return;
    }

    const cleanXml = xml
      .trim()
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");

    console.log("Loading diagram with XML length:", cleanXml.length);

    setLoading(true);
    setError(null);

    try {
      const result = await modelerRef.current.importXML(cleanXml);

      if (result.warnings?.length) {
        console.warn("Warnings while importing BPMN diagram:", result.warnings);
      }

      const canvas = modelerRef.current.get("canvas");
      if (canvas) {
        canvas.zoom("fit-viewport");
      }
    } catch (err) {
      console.error("Error loading diagram:", err);
      setError(translations.error.load);

      // Fallback: leeres Diagramm
      try {
        await modelerRef.current.importXML(emptyBpmn);
        const canvas = modelerRef.current.get("canvas");
        if (canvas) {
          canvas.zoom("fit-viewport");
        }
      } catch (fallbackErr) {
        console.error("Error loading empty diagram:", fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  // Beim ersten Rendern
  useEffect(() => {
    console.log("BpmnEditor mounted or diagram changed");
    const timer = setTimeout(() => {
      initializeModeler();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (modelerRef.current) {
        console.log("Destroying BPMN modeler");
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, []);

  // Wenn sich das Diagramm ändert (bpmnXml)
  useEffect(() => {
    if (diagram?.bpmnXml && modelerRef.current) {
      console.log("Loading new diagram (diagram changed)");
      loadDiagram(diagram.bpmnXml);
    }
  }, [diagram?.bpmnXml]);

  const handleSave = async () => {
    if (!modelerRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const canvas = modelerRef.current.get("canvas");
      const viewbox = canvas ? canvas.viewbox() : null;

      await onSave(
        {
          ...diagram,
          bpmnXml: xml,
          flowData: viewbox ? JSON.stringify(viewbox) : "{}",
          name: diagram?.name || "Neues Diagramm",
          description: diagram?.description || "Ein BPMN-Prozessdiagramm",
        },
        comment
      );

      setComment("");
      setShowVersionDialog(false);
    } catch (err) {
      console.error("Error saving diagram:", err);
      setError(translations.error.save);
    } finally {
      setLoading(false);
    }
  };

  const loadVersion = async (versionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/diagrams/${diagram?.id}/versions/${versionId}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const version = await response.json();
      await loadDiagram(version.bpmnXml);
    } catch (err) {
      console.error("Error loading version:", err);
      setError(translations.error.load);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col relative">
      {/* Toolbar */}
      <div className="p-4 border-b flex justify-between items-center">
        <div className="flex items-center gap-4">
          {diagram && versions && versions.length > 0 && (
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
                {versions?.map((version) => (
                  <SelectItem key={version.id} value={version.version.toString()}>
                    {translations.version} {version.version}
                    {version.comment ? ` - ${version.comment}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>
        <Button onClick={() => setShowVersionDialog(true)} disabled={loading || readOnly}>
          {translations.save}
        </Button>
      </div>

      {/* BPMN Canvas */}
      <div ref={containerRef} className="flex-1 bpmn-editor-container" />

      {loading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-50">
          <div className="text-lg font-semibold">Lädt...</div>
        </div>
      )}

      <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{translations.saveVersion}</DialogTitle>
            <DialogDescription>
              {diagram?.id
                ? "Speichern Sie eine neue Version des Diagramms"
                : "Erstellen Sie ein neues Diagramm"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder={translations.versionComment}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button onClick={handleSave} disabled={loading || readOnly}>
              {translations.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
