-- Erstelle die diagrams Tabelle
CREATE TABLE diagrams (
    id serial PRIMARY KEY,
    name text NOT NULL,
    description text,
    bpmn_xml text NOT NULL,
    flow_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    optimization_suggestions jsonb DEFAULT '{}'::jsonb,
    current_version integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Erstelle die diagram_versions Tabelle
CREATE TABLE diagram_versions (
    id serial PRIMARY KEY,
    diagram_id integer REFERENCES diagrams(id) ON DELETE CASCADE,
    version integer NOT NULL,
    bpmn_xml text NOT NULL,
    flow_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    comment text,
    created_at timestamp with time zone DEFAULT now()
);
