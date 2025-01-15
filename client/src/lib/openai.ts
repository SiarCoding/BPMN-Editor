// the newest OpenAI model is "gpt-4o" which was released May 13, 2024

export async function analyzeBPMNProcess(bpmnXml: string) {
  try {
    if (!bpmnXml) {
      throw new Error("Kein BPMN XML übergeben");
    }

    console.log("Sending optimization request...");
    const response = await fetch("/api/optimize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bpmnXml }),
    });

    // Lese den Response-Body
    const responseText = await response.text();
    console.log("Received response:", responseText.substring(0, 200) + "...");

    // Versuche den Response als JSON zu parsen
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Error parsing response:", parseError);
      console.error("Response text:", responseText);
      throw new Error("Ungültige Server-Antwort: Kein valides JSON");
    }

    // Prüfe auf Fehlermeldung vom Server
    if (!response.ok) {
      const errorMessage =
        data?.error || data?.details || `Optimierung fehlgeschlagen: ${response.status}`;
      console.error("Server error:", errorMessage);
      throw new Error(errorMessage);
    }

    // Validiere die Antwort
    if (!data || typeof data !== "object") {
      console.error("Invalid response data:", data);
      throw new Error("Ungültige Antwort vom Server: Kein Objekt");
    }

    if (!data.optimized_bpmn || typeof data.optimized_bpmn !== "string") {
      console.error("Missing or invalid optimized_bpmn:", data);
      throw new Error("Ungültige Antwort vom Server: Fehlendes oder ungültiges BPMN");
    }

    if (!Array.isArray(data.vorschlaege) || data.vorschlaege.length === 0) {
      console.error("Missing or invalid suggestions:", data);
      throw new Error("Ungültige Antwort vom Server: Keine Optimierungsvorschläge");
    }

    return data;
  } catch (error) {
    console.error("Fehler bei der Prozessanalyse:", error);
    throw error;
  }
}

export async function analyzeProcess(bpmnXml: string) {
  return analyzeBPMNProcess(bpmnXml);
}

export async function analyzeBPMNProcessOnly(bpmnXml: string) {
  const systemPrompt = `You are a BPMN process optimization expert. Analyze the following BPMN diagram XML and:
1. Identify all process elements (activities, events, gateways)
2. Understand the process flow and relationships
3. Identify potential bottlenecks and inefficiencies
4. Suggest process optimizations
5. Generate an optimized BPMN diagram that implements these improvements

Focus on:
- Reducing unnecessary steps
- Parallelizing activities where possible
- Eliminating bottlenecks
- Improving process efficiency
- Maintaining process integrity and business rules

Return the analysis and optimized BPMN in the following JSON structure:
{
  "analysis": {
    "elements": [],
    "flows": [],
    "bottlenecks": [],
    "optimization_potential": []
  },
  "optimized_bpmn": "XML string",
  "explanation": "Detailed explanation"
}`;

  // Falls du das nochmal extra brauchst:
  return analyzeBPMNProcess(bpmnXml);
}
