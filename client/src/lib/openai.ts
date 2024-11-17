// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
export async function analyzeProcess(bpmnXml: string, flowData: any) {
  try {
    const response = await fetch("/api/optimize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bpmnXml,
        flowData,
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
