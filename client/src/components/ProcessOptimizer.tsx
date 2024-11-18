import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Diagram } from "../../db/schema";
import { translations } from "../lib/translations";

interface ProcessOptimizerProps {
  diagram: Diagram | null;
}

interface Suggestion {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
}

export function ProcessOptimizer({ diagram }: ProcessOptimizerProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (diagram?.flowData) {
      analyzeDiagram();
    }
  }, [diagram]);

  const analyzeDiagram = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bpmnXml: diagram?.bpmnXml,
          flowData: diagram?.flowData,
        }),
      });
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error("Optimization error:", error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-80 p-4 m-4 h-[calc(100vh-8rem)]">
      <h2 className="text-xl font-bold mb-4">{translations.optimizationSuggestions}</h2>
      {loading ? (
        <div className="flex items-center justify-center h-full">
          {translations.analyzing}...
        </div>
      ) : (
        <ScrollArea className="h-[calc(100%-3rem)]">
          {(suggestions || []).map((suggestion, index) => (
            <div
              key={index}
              className={`p-3 mb-3 rounded-lg border ${
                suggestion.impact === "high"
                  ? "border-red-200 bg-red-50"
                  : suggestion.impact === "medium"
                  ? "border-yellow-200 bg-yellow-50"
                  : "border-green-200 bg-green-50"
              }`}
            >
              <h3 className="font-semibold mb-1">{suggestion.title}</h3>
              <p className="text-sm text-gray-600">{suggestion.description}</p>
            </div>
          ))}
        </ScrollArea>
      )}
    </Card>
  );
}
