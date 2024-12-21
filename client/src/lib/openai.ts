// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
export async function analyzeBPMNProcess(bpmnXml: string) {
  try {
    const response = await fetch("/api/optimize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bpmnXml,
      }),
    });

    if (!response.ok) {
      throw new Error("Optimierung fehlgeschlagen");
    }

    return await response.json();
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

  return analyzeBPMNProcess(bpmnXml);
}
