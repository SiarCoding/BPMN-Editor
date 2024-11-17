import type { Express } from "express";
import { db } from "../db";
import { diagrams, diagramVersions } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function registerRoutes(app: Express) {
  // Get all diagrams
  app.get("/api/diagrams", async (req, res) => {
    try {
      const allDiagrams = await db.select().from(diagrams);
      res.json(allDiagrams);
    } catch (error) {
      res.status(500).json({ error: "Fehler beim Laden der Diagramme" });
    }
  });

  // Get single diagram
  app.get("/api/diagrams/:id", async (req, res) => {
    try {
      const diagram = await db
        .select()
        .from(diagrams)
        .where(eq(diagrams.id, parseInt(req.params.id)));
      if (diagram.length === 0) {
        res.status(404).json({ error: "Diagramm nicht gefunden" });
        return;
      }
      res.json(diagram[0]);
    } catch (error) {
      res.status(500).json({ error: "Fehler beim Laden des Diagramms" });
    }
  });

  // Create new diagram
  app.post("/api/diagrams", async (req, res) => {
    try {
      const newDiagram = await db.transaction(async (tx) => {
        // Create the diagram
        const [diagram] = await tx
          .insert(diagrams)
          .values(req.body)
          .returning();

        // Create initial version
        await tx.insert(diagramVersions).values({
          diagramId: diagram.id,
          version: 1,
          bpmnXml: diagram.bpmnXml,
          flowData: diagram.flowData,
          comment: "Initial version",
        });

        return diagram;
      });
      res.json(newDiagram);
    } catch (error) {
      res.status(500).json({ error: "Fehler beim Erstellen des Diagramms" });
    }
  });

  // Update diagram
  app.put("/api/diagrams/:id", async (req, res) => {
    try {
      const diagramId = parseInt(req.params.id);
      const { comment, ...diagramData } = req.body;

      const updatedDiagram = await db.transaction(async (tx) => {
        // Get current version
        const [currentDiagram] = await tx
          .select()
          .from(diagrams)
          .where(eq(diagrams.id, diagramId));

        const newVersion = currentDiagram.currentVersion + 1;

        // Create new version
        await tx.insert(diagramVersions).values({
          diagramId,
          version: newVersion,
          bpmnXml: diagramData.bpmnXml,
          flowData: diagramData.flowData,
          comment: comment || `Version ${newVersion}`,
        });

        // Update diagram with new version
        const [updated] = await tx
          .update(diagrams)
          .set({
            ...diagramData,
            currentVersion: newVersion,
            updatedAt: new Date(),
          })
          .where(eq(diagrams.id, diagramId))
          .returning();

        return updated;
      });

      res.json(updatedDiagram);
    } catch (error) {
      res.status(500).json({ error: "Fehler beim Aktualisieren des Diagramms" });
    }
  });

  // Get diagram versions
  app.get("/api/diagrams/:id/versions", async (req, res) => {
    try {
      const versions = await db
        .select()
        .from(diagramVersions)
        .where(eq(diagramVersions.diagramId, parseInt(req.params.id)))
        .orderBy(desc(diagramVersions.version));
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: "Fehler beim Laden der Versionen" });
    }
  });

  // Get specific version
  app.get("/api/diagrams/:id/versions/:version", async (req, res) => {
    try {
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
        res.status(404).json({ error: "Version nicht gefunden" });
        return;
      }
      res.json(version);
    } catch (error) {
      res.status(500).json({ error: "Fehler beim Laden der Version" });
    }
  });

  // Delete diagram
  app.delete("/api/diagrams/:id", async (req, res) => {
    try {
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
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Fehler beim Löschen des Diagramms" });
    }
  });

  // Get optimization suggestions
  app.post("/api/optimize", async (req, res) => {
    try {
      const { bpmnXml, flowData } = req.body;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Du bist ein BPMN-Prozessoptimierer. Analysiere den Prozess und gib Verbesserungsvorschläge in deutscher Sprache."
          },
          {
            role: "user",
            content: JSON.stringify({ bpmnXml, flowData })
          }
        ],
        response_format: { type: "json_object" }
      });

      const suggestions = JSON.parse(response.choices[0].message.content);
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ error: "Fehler bei der Prozessoptimierung" });
    }
  });
}
