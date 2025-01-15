-- Lösche existierende Tabellen
DROP TABLE IF EXISTS diagram_versions;
DROP TABLE IF EXISTS diagrams;

-- Erstelle die diagrams Tabelle
CREATE TABLE diagrams (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    bpmn_xml TEXT NOT NULL,
    flow_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    optimization_suggestions JSONB DEFAULT '{}'::jsonb,
    current_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Erstelle die diagram_versions Tabelle
CREATE TABLE diagram_versions (
    id SERIAL PRIMARY KEY,
    diagram_id INTEGER NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    bpmn_xml TEXT NOT NULL,
    flow_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Füge Testdaten ein
DO $$ 
DECLARE
    new_diagram_id INTEGER;
BEGIN
    INSERT INTO diagrams (
        name, 
        description, 
        bpmn_xml, 
        flow_data, 
        current_version
    ) VALUES (
        'Test Diagram',
        'Ein Testdiagramm',
        '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"></bpmn:definitions>',
        '{"nodes": [], "edges": []}'::jsonb,
        1
    ) RETURNING id INTO new_diagram_id;

    -- Füge initiale Version ein
    INSERT INTO diagram_versions (
        diagram_id,
        version,
        bpmn_xml,
        flow_data,
        comment
    ) VALUES (
        new_diagram_id,
        1,
        '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"></bpmn:definitions>',
        '{"nodes": [], "edges": []}'::jsonb,
        'Initiale Version'
    );
END $$;
