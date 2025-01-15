import type { Express } from "express";
import { db } from "../db";
import { diagrams, diagramVersions } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
  defaultHeaders: {
    "OpenAI-Beta": "project",
    "OpenAI-Organization": process.env.OPENAI_ORG_ID || "",
  },
});

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
        const [diagram] = await tx.insert(diagrams).values(req.body).returning();

        console.log("Created diagram:", diagram.id);

        // Create initial version
        const [version] = await tx
          .insert(diagramVersions)
          .values({
            diagramId: diagram.id,
            version: 1,
            bpmnXml: diagram.bpmnXml,
            flowData: diagram.flowData,
            comment: "Initial version",
          })
          .returning();

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
        const [version] = await tx
          .insert(diagramVersions)
          .values({
            diagramId,
            version: newVersion,
            bpmnXml: diagramData.bpmnXml,
            flowData: diagramData.flowData,
            comment: comment || `Version ${newVersion}`,
          })
          .returning();

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
      res
        .status(500)
        .json({ error: "Fehler beim Aktualisieren des Diagramms" });
    }
  });

  // Get diagram versions
  app.get("/api/diagrams/:id/versions", async (req, res) => {
    try {
      const diagramId = parseInt(req.params.id);
      console.log("Fetching versions for diagram:", diagramId);

      if (isNaN(diagramId)) {
        return res.status(400).json({
          error: "Ungültige Diagramm-ID",
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
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get specific version
  app.get("/api/diagrams/:id/versions/:version", async (req, res) => {
    try {
      console.log(
        "Fetching version:",
        req.params.version,
        "for diagram:",
        req.params.id
      );
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
      res
        .status(500)
        .json({ error: "Fehler beim Laden der Version" });
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
          { role: "user", content: userPrompt },
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
          details: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      console.error("Error analyzing BPMN:", error);
      res.status(500).json({
        error: "Fehler bei der Prozessanalyse",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Optimize BPMN process
  app.post("/api/optimize", async (req, res) => {
    try {
      const { bpmnXml } = req.body;

      if (!bpmnXml || typeof bpmnXml !== "string") {
        return res.status(400).json({
          error: "Ungültiger BPMN XML Input",
          details: "BPMN XML muss als String übergeben werden",
        });
      }

      console.log("Starting OpenAI optimization request");
      const completion = await openai.chat.completions.create({
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

Evaluationskriterien:
  Berücksichtigen Sie bei der Analyse eines Geschäftsprozesses folgende Kriterien:
    1. Effizienz: Minimieren Sie Durchlaufzeiten und verbessern Sie den Ablauf zwischen Prozessschritten.
    2. Genauigkeit: Reduzieren Sie Fehler und Inkonsistenzen im Prozess.
    3. Stakeholder-Zufriedenheit: Optimieren Sie die Erfahrung und Zufriedenheit interner (Mitarbeiter) und externer Stakeholder (Kunden, Partner).
    4. Anpassungsfähigkeit: Gestalten Sie den Prozess flexibel und widerstandsfähig gegenüber Veränderungen.
    5. Wertschöpfung: Priorisieren Sie Aktivitäten, die zur Wertschöpfung beitragen, und eliminieren Sie nicht-wertschöpfende Tätigkeiten.

Optimierungsrichtlinien:
  Nutzen Sie diese Prinzipien, um konkrete Verbesserungen vorzuschlagen:
    1. Klare Ziele definieren: Fokus auf messbare Ergebnisse wie Kostensenkung, Qualitätssteigerung oder Durchlaufzeitverkürzung.
    2. Stakeholder-Fokus: Berücksichtigen Sie die Erwartungen und Bedürfnisse aller Prozessbeteiligten.
    3. Nicht-wertschöpfende Tätigkeiten eliminieren: Identifizieren und beseitigen Sie Redundanzen, Verzögerungen und überflüssige Schritte.
    4. Technologische Lösungen nutzen: Schlagen Sie spezifische Systeme vor, z. B. Onlineformulare, ERP-Systeme, RPA, Chatbots oder andere Technologien, die Prozesse automatisieren und parallele Abläufe ermöglichen.
    5. Kommunikation verbessern: Fördern Sie transparente, zeitnahe und klare Kommunikation zwischen allen Beteiligten.
    6. Kosten-Nutzen-Verhältnis beachten: Optimierungen sollten die Kosten nicht übersteigen und einen klaren Mehrwert bieten.
    7. Inter- und intra-departmentale Zusammenarbeit verbessern: Fördern Sie reibungslose Übergänge und Synchronisation zwischen Teams, Abteilungen und Systemen.
    8. Reale Umsetzungsmöglichkeiten: Liefern Sie umsetzbare Vorschläge, wie spezifische Technologien oder Werkzeuge die Prozesse verbessern können. Beispiele: Einführung eines Onlineformulars zur Dateneingabe, Implementierung eines Chatbots für die Kundenkommunikation oder Nutzung eines ERP-Systems für eine bessere Datenintegration.

Antworte EXAKT in diesem Format (als valides JSON):
{
  "vorschlaege": [
    "Liste der konkreten Optimierungsvorschläge"
  ],
  "optimized_bpmn": "Vollständiges, valides BPMN 2.0 XML mit allen Optimierungen"
}`,
          },
          {
            role: "user",
            content: `Hier ist der zu optimierende BPMN-Prozess. Behalte die XML-Struktur bei und optimiere nur den Prozessfluss. Antworte NUR mit einem validen JSON-Objekt:

${bpmnXml}

Erstelle ein optimiertes BPMN XML und liste die Verbesserungen auf.`,
          },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      });

      console.log("Received OpenAI response");
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        console.error("No content in OpenAI response");
        return res.status(500).json({
          error: "Keine Antwort von OpenAI erhalten",
          details: "Die Antwort enthielt keinen Content",
        });
      }

      try {
        console.log("Raw OpenAI response:", content.substring(0, 200) + "...");
        // Entferne evtl. Markdown-Formatierung
        let cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
        console.log("Cleaned content:", cleanContent.substring(0, 200) + "...");

        let result: any;
        try {
          // Erster Parse-Versuch
          result = JSON.parse(cleanContent);
        } catch (primaryParseError) {
          // Fallback: Suche JSON-Codeblock
          const match = cleanContent.match(/```json\s*([\s\S]*?)\s*```/);
          if (match && match[1]) {
            const jsonString = match[1].trim();
            result = JSON.parse(jsonString);
          } else {
            console.error("No valid JSON block found in GPT-4 response.");
            throw primaryParseError;
          }
        }

        // Validiere das BPMN XML
        if (
          !result.optimized_bpmn ||
          !result.optimized_bpmn.includes("<?xml") ||
          !result.optimized_bpmn.includes("bpmn:definitions")
        ) {
          console.error("Invalid BPMN XML in result:", result);
          return res.status(500).json({
            error: "Ungültiges BPMN XML",
            details: "OpenAI hat kein valides BPMN XML generiert",
          });
        }

        // Validiere die Vorschläge
        if (
          !Array.isArray(result.vorschlaege) ||
          result.vorschlaege.length === 0
        ) {
          console.error("No optimization suggestions in result:", result);
          return res.status(500).json({
            error: "Keine Optimierungsvorschläge",
            details: "OpenAI hat keine Verbesserungsvorschläge generiert",
          });
        }

        // BPMN noch etwas bereinigen
        result.optimized_bpmn = result.optimized_bpmn
          .trim()
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\")
          .replace(/^\s*<\?xml/, "<?xml");

        console.log("Sending optimized result");
        res.json(result);
      } catch (parseError) {
        console.error("Error parsing OpenAI response:", parseError);
        console.error("Raw content:", content);
        res.status(500).json({
          error: "Fehler beim Verarbeiten der KI-Antwort",
          details: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }
    } catch (error) {
      console.error("Error in process optimization:", error);
      res.status(500).json({
        error: "Fehler bei der Prozessoptimierung",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
