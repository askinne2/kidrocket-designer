-- Migration: Create rockets table
-- Description: Store rocket designs with comprehensive configuration data
-- Dependencies: 001_create_users_table.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS rockets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Rocket Configuration (stored as JSONB for flexibility)
    config JSONB NOT NULL,
    
    -- Metadata
    thumbnail TEXT, -- base64 or URL
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    likes INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    complexity VARCHAR(20) DEFAULT 'beginner' CHECK (complexity IN ('beginner', 'intermediate', 'advanced', 'expert')),
    estimated_cost DECIMAL(10,2) DEFAULT 0.00,
    build_time INTEGER DEFAULT 0, -- hours
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_rockets_user_id ON rockets(user_id);
CREATE INDEX idx_rockets_created_at ON rockets(created_at DESC);
CREATE INDEX idx_rockets_is_public ON rockets(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_rockets_complexity ON rockets(complexity);
CREATE INDEX idx_rockets_tags ON rockets USING GIN(tags);
CREATE INDEX idx_rockets_likes ON rockets(likes DESC) WHERE is_public = TRUE;
CREATE INDEX idx_rockets_name_search ON rockets USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Full-text search index for rocket names and descriptions
CREATE INDEX idx_rockets_fulltext ON rockets USING GIN(
    to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || array_to_string(tags, ' '))
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rockets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rockets_updated_at_trigger
    BEFORE UPDATE ON rockets
    FOR EACH ROW
    EXECUTE FUNCTION update_rockets_updated_at();

-- Add constraints for rocket configuration validation
-- These will be enforced at the application level, but documented here
COMMENT ON COLUMN rockets.config IS 'JSONB containing complete rocket configuration including body, noseCone, fins, engine, recovery, and launch parameters';
COMMENT ON COLUMN rockets.version IS 'Version number for rocket design, incremented on significant changes';
COMMENT ON COLUMN rockets.is_public IS 'Whether this rocket design is visible to other users';
COMMENT ON COLUMN rockets.likes IS 'Number of likes/favorites from other users';
COMMENT ON COLUMN rockets.downloads IS 'Number of times this design has been downloaded/copied';
COMMENT ON COLUMN rockets.complexity IS 'Build complexity level: beginner, intermediate, advanced, expert';
COMMENT ON COLUMN rockets.estimated_cost IS 'Estimated build cost in USD';
COMMENT ON COLUMN rockets.build_time IS 'Estimated build time in hours';

-- Sample rocket configuration structure (for documentation)
/*
Example config JSONB structure:
{
  "body": {
    "length": 0.6,
    "diameter": 0.024,
    "mass": 0.1,
    "material": "cardboard",
    "fineness": 25
  },
  "noseCone": {
    "type": "ogive",
    "length": 0.1,
    "mass": 0.02,
    "material": "balsa"
  },
  "fins": {
    "count": 4,
    "span": 0.08,
    "rootChord": 0.06,
    "tipChord": 0.03,
    "sweepAngle": 30,
    "thickness": 0.003,
    "material": "balsa",
    "mass": 0.01
  },
  "engine": {
    "type": "C",
    "thrust": 12,
    "burnTime": 2.5,
    "specificImpulse": 180,
    "propellantMass": 0.024,
    "totalMass": 0.038
  },
  "recovery": {
    "type": "parachute",
    "deploymentAltitude": 150,
    "parachuteDiameter": 0.3,
    "chuteCount": 1,
    "mass": 0.02
  },
  "launch": {
    "launchAngle": 0,
    "launchRodLength": 1.2,
    "windSpeed": 5,
    "windDirection": 0
  }
}
*/
