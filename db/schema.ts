import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const diagrams = pgTable("diagrams", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  description: text("description"),
  bpmnXml: text("bpmn_xml").notNull(),
  flowData: jsonb("flow_data").notNull(),
  optimizationSuggestions: jsonb("optimization_suggestions"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDiagramSchema = createInsertSchema(diagrams);
export const selectDiagramSchema = createSelectSchema(diagrams);
export type InsertDiagram = z.infer<typeof insertDiagramSchema>;
export type Diagram = z.infer<typeof selectDiagramSchema>;
