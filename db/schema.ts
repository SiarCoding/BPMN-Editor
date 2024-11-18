import { pgTable, text, integer, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const diagrams = pgTable("diagrams", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  description: text("description"),
  bpmnXml: text("bpmn_xml").notNull(),
  flowData: jsonb("flow_data").notNull(),
  optimizationSuggestions: jsonb("optimization_suggestions"),
  currentVersion: integer("current_version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const diagramVersions = pgTable("diagram_versions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  diagramId: integer("diagram_id")
    .notNull()
    .references(() => diagrams.id, { onDelete: 'cascade' }),
  version: integer("version").notNull(),
  bpmnXml: text("bpmn_xml").notNull(),
  flowData: jsonb("flow_data").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Add a unique constraint to prevent duplicate versions for the same diagram
export const diagramVersionConstraint = {
  name: "unique_diagram_version",
  columns: ["diagram_id", "version"],
};

export const insertDiagramSchema = createInsertSchema(diagrams);
export const selectDiagramSchema = createSelectSchema(diagrams);
export const insertVersionSchema = createInsertSchema(diagramVersions);
export const selectVersionSchema = createSelectSchema(diagramVersions);

export type InsertDiagram = z.infer<typeof insertDiagramSchema>;
export type Diagram = z.infer<typeof selectDiagramSchema>;
export type DiagramVersion = z.infer<typeof selectVersionSchema>;
