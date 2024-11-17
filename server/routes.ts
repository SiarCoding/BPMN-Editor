import type { Express } from "express";
import { db } from "../db";
import { diagrams } from "../db/schema";
import { eq } from "drizzle-orm";
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
      const newDiagram = await db
        .insert(diagrams)
        .values(req.body)
        .returning();
      res.json(newDiagram[0]);
    } catch (error) {
      res.status(500).json({ error: "Fehler beim Erstellen des Diagramms" });
    }
  });

  // Update diagram
  app.put("/api/diagrams/:id", async (req, res) => {
    try {
      const updatedDiagram = await db
        .update(diagrams)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(diagrams.id, parseInt(req.params.id)))
        .returning();
      res.json(updatedDiagram[0]);
    } catch (error) {
      res.status(500).json({ error: "Fehler beim Aktualisieren des Diagramms" });
    }
  });

  // Delete diagram
  app.delete("/api/diagrams/:id", async (req, res) => {
    try {
      await db
        .delete(diagrams)
        .where(eq(diagrams.id, parseInt(req.params.id)));
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
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
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
