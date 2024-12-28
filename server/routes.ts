import type { Express } from "express";
import { db } from "../db";
import { diagrams, diagramVersions } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function registerRoutes(app: Express) {
  // Get all diagrams
  app.get("/api/diagrams", async (req, res) => {
    try {
      console.log("Fetching all diagrams");
      const allDiagrams = await db.select().from(diagrams);
      console.log("Found diagrams:", allDiagrams.length);
      res.json(allDiagrams);
    } catch (error) {
      console.error("Error fetching diagrams:", error);
      res.status(500).json({ error: "Fehler beim Laden der Diagramme" });
    }
  });

  // Get single diagram
  app.get("/api/diagrams/:id", async (req, res) => {
    try {
      console.log("Fetching diagram:", req.params.id);
      const diagram = await db
        .select()
        .from(diagrams)
        .where(eq(diagrams.id, parseInt(req.params.id)));
      if (diagram.length === 0) {
        console.log("Diagram not found:", req.params.id);
        res.status(404).json({ error: "Diagramm nicht gefunden" });
        return;
      }
      console.log("Found diagram:", diagram[0].id);
      res.json(diagram[0]);
    } catch (error) {
      console.error("Error fetching diagram:", error);
      res.status(500).json({ error: "Fehler beim Laden des Diagramms" });
    }
  });

  // Create new diagram
  app.post("/api/diagrams", async (req, res) => {
    try {
      console.log("Creating new diagram");
      const newDiagram = await db.transaction(async (tx) => {
        // Create the diagram
        const [diagram] = await tx
          .insert(diagrams)
          .values(req.body)
          .returning();

        console.log("Created diagram:", diagram.id);

        // Create initial version
        const [version] = await tx.insert(diagramVersions).values({
          diagramId: diagram.id,
          version: 1,
          bpmnXml: diagram.bpmnXml,
          flowData: diagram.flowData,
          comment: "Initial version",
        }).returning();

        console.log("Created initial version:", version.id);
        return diagram;
      });

      console.log("Successfully created diagram and version");
      res.json(newDiagram);
    } catch (error) {
      console.error("Error creating diagram:", error);
      res.status(500).json({ error: "Fehler beim Erstellen des Diagramms" });
    }
  });

  // Update diagram
  app.put("/api/diagrams/:id", async (req, res) => {
    try {
      const diagramId = parseInt(req.params.id);
      console.log("Updating diagram:", diagramId);
      const { comment, ...diagramData } = req.body;

      const updatedDiagram = await db.transaction(async (tx) => {
        // Get current version
        const [currentDiagram] = await tx
          .select()
          .from(diagrams)
          .where(eq(diagrams.id, diagramId));

        if (!currentDiagram) {
          throw new Error("Diagram not found");
        }

        const newVersion = currentDiagram.currentVersion + 1;
        console.log("Creating version:", newVersion);

        // Create new version
        const [version] = await tx.insert(diagramVersions).values({
          diagramId,
          version: newVersion,
          bpmnXml: diagramData.bpmnXml,
          flowData: diagramData.flowData,
          comment: comment || `Version ${newVersion}`,
        }).returning();

        console.log("Created version:", version.id);

        // Update diagram with new version
        const [updated] = await tx
          .update(diagrams)
          .set({
            ...diagramData,
            currentVersion: newVersion,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(diagrams.id, diagramId))
          .returning();

        console.log("Updated diagram:", updated.id);
        return updated;
      });

      console.log("Successfully updated diagram and created new version");
      res.json(updatedDiagram);
    } catch (error) {
      console.error("Error updating diagram:", error);
      res.status(500).json({ error: "Fehler beim Aktualisieren des Diagramms" });
    }
  });

  // Get diagram versions
  app.get("/api/diagrams/:id/versions", async (req, res) => {
    try {
      const diagramId = parseInt(req.params.id);
      console.log("Fetching versions for diagram:", diagramId);
      
      if (isNaN(diagramId)) {
        return res.status(400).json({ 
          error: "Ungültige Diagramm-ID" 
        });
      }

      const versions = await db
        .select()
        .from(diagramVersions)
        .where(eq(diagramVersions.diagramId, diagramId))
        .orderBy(desc(diagramVersions.version));

      console.log("Found versions:", versions.length);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching versions:", error);
      res.status(500).json({ 
        error: "Fehler beim Laden der Versionen",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get specific version
  app.get("/api/diagrams/:id/versions/:version", async (req, res) => {
    try {
      console.log("Fetching version:", req.params.version, "for diagram:", req.params.id);
      const [version] = await db
        .select()
        .from(diagramVersions)
        .where(
          and(
            eq(diagramVersions.diagramId, parseInt(req.params.id)),
            eq(diagramVersions.version, parseInt(req.params.version))
          )
        );
      if (!version) {
        console.log("Version not found");
        res.status(404).json({ error: "Version nicht gefunden" });
        return;
      }
      console.log("Found version:", version.id);
      res.json(version);
    } catch (error) {
      console.error("Error fetching version:", error);
      res.status(500).json({ error: "Fehler beim Laden der Version" });
    }
  });

  // Delete diagram
  app.delete("/api/diagrams/:id", async (req, res) => {
    try {
      console.log("Deleting diagram:", req.params.id);
      await db.transaction(async (tx) => {
        // Delete all versions first
        await tx
          .delete(diagramVersions)
          .where(eq(diagramVersions.diagramId, parseInt(req.params.id)));
        
        // Then delete the diagram
        await tx
          .delete(diagrams)
          .where(eq(diagrams.id, parseInt(req.params.id)));
      });
      console.log("Successfully deleted diagram and versions");
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting diagram:", error);
      res.status(500).json({ error: "Fehler beim Löschen des Diagramms" });
    }
  });

  // Analyze BPMN process
  app.post("/api/analyze", async (req, res) => {
    try {
      const { bpmnXml } = req.body;

      if (!bpmnXml) {
        return res.status(400).json({ error: "BPMN XML ist erforderlich" });
      }

      const systemPrompt = `Du bist ein BPMN-Prozessoptimierer. Analysiere den gegebenen BPMN-Prozess und erstelle:
1. Eine Liste von Optimierungsvorschlägen
2. Ein optimiertes BPMN-XML, das diese Vorschläge umsetzt

Berücksichtige dabei:
- Prozesseffizienz und Durchlaufzeit
- Ressourcennutzung
- Automatisierungspotenzial
- Best Practices der Prozessmodellierung

Gib deine Antwort als JSON mit den Feldern 'vorschlaege' (Array von Strings) und 'optimized_bpmn' (String) zurück.`;

      const userPrompt = `Hier ist der BPMN-Prozess zur Optimierung:

${bpmnXml}

Analysiere den Prozess und erstelle:
1. Konkrete Optimierungsvorschläge
2. Ein optimiertes BPMN-XML, das diese Vorschläge umsetzt

Formatiere deine Antwort als valides JSON.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      const response = completion.choices[0].message.content;
      
      try {
        const result = JSON.parse(response || "{}");
        if (!result.vorschlaege || !result.optimized_bpmn) {
          throw new Error("Ungültiges Antwortformat");
        }
        res.json(result);
      } catch (error) {
        console.error("Error parsing OpenAI response:", error);
        res.status(500).json({ 
          error: "Fehler beim Verarbeiten der KI-Antwort",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      console.error("Error analyzing BPMN:", error);
      res.status(500).json({ 
        error: "Fehler bei der Prozessanalyse",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get optimization suggestions
  app.post("/api/optimize", async (req, res) => {
    try {
      const { bpmnXml } = req.body;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Du bist ein BPMN-Prozessoptimierer. Deine Aufgabe ist es, BPMN-Prozesse zu analysieren und zu optimieren.

WICHTIG: Du kennst alle BPMN 2.0 Elemente und deren XML-Struktur:
- Events (startEvent, endEvent, intermediateThrowEvent, intermediateCatchEvent)
- Activities (task, userTask, serviceTask, sendTask, receiveTask)
- Gateways (exclusiveGateway, parallelGateway, inclusiveGateway)
- Flows (sequenceFlow, messageFlow)
- Artifacts (textAnnotation, association)
- Containers (process, subProcess, participant, lane)

Analysiere den gegebenen BPMN-Prozess XML und:
1. Identifiziere Optimierungspotenziale wie:
   - Unnötige Sequenzflüsse
   - Fehlende Parallelisierung
   - Überflüssige Aktivitäten
   - Komplexe Gateway-Strukturen
   - Fehlende Error Handling

2. Erstelle ein optimiertes BPMN XML das:
   - Die identifizierten Probleme behebt
   - Parallele Ausführung wo möglich nutzt
   - Die Prozesslogik vereinfacht
   - Valides BPMN 2.0 XML ist
   - Die IDs der originalen Elemente beibehält

Antworte NUR in diesem JSON-Format:
{
  "vorschlaege": [
    "Liste konkreter Optimierungsvorschläge"
  ],
  "optimized_bpmn": "Optimiertes BPMN 2.0 XML mit allen Verbesserungen"
}`
          },
          {
            role: "user",
            content: bpmnXml
          }
        ],
        temperature: 0,
        max_tokens: 4000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Keine Antwort von OpenAI erhalten");
      }

      const result = JSON.parse(content);
      res.json(result);
    } catch (error) {
      console.error("Error in process optimization:", error);
      res.status(500).json({ error: "Fehler bei der Prozessoptimierung" });
    }
  });
}
