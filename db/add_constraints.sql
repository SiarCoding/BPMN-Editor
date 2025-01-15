ALTER TABLE diagram_versions 
ADD CONSTRAINT diagram_versions_unique_version UNIQUE (diagram_id, version);
