-- Migration: Create simulations table
-- Description: Store simulation results and telemetry data for rocket flights
-- Dependencies: 001_create_users_table.sql, 003_create_rockets_table.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rocket_id UUID NOT NULL REFERENCES rockets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Snapshot of rocket config used for this simulation
    rocket_config JSONB NOT NULL,
    
    -- Flight Results Summary
    results JSONB NOT NULL,
    
    -- Weather Conditions
    weather JSONB NOT NULL,
    
    -- Launch Options Used
    launch_options JSONB,
    
    -- Performance Summary (denormalized for quick queries)
    max_altitude DECIMAL(10,3) NOT NULL, -- meters AGL
    max_velocity DECIMAL(10,3) NOT NULL, -- m/s
    flight_time DECIMAL(10,3) NOT NULL, -- seconds
    successful BOOLEAN NOT NULL DEFAULT TRUE,
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Separate table for detailed telemetry data (can be large)
CREATE TABLE IF NOT EXISTS simulation_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    
    -- Telemetry data as JSONB array of trajectory points
    telemetry_data JSONB NOT NULL,
    
    -- Metadata about telemetry
    time_step DECIMAL(6,4) NOT NULL DEFAULT 0.1, -- seconds
    total_points INTEGER NOT NULL,
    data_size_kb INTEGER, -- for monitoring storage usage
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_simulations_rocket_id ON simulations(rocket_id);
CREATE INDEX idx_simulations_user_id ON simulations(user_id);
CREATE INDEX idx_simulations_created_at ON simulations(created_at DESC);
CREATE INDEX idx_simulations_max_altitude ON simulations(max_altitude DESC);
CREATE INDEX idx_simulations_score ON simulations(score DESC);
CREATE INDEX idx_simulations_successful ON simulations(successful);

-- Telemetry indexes
CREATE INDEX idx_simulation_telemetry_simulation_id ON simulation_telemetry(simulation_id);
CREATE INDEX idx_simulation_telemetry_created_at ON simulation_telemetry(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_simulations_user_rocket ON simulations(user_id, rocket_id, created_at DESC);
CREATE INDEX idx_simulations_performance ON simulations(successful, score DESC, max_altitude DESC) WHERE successful = TRUE;

-- Comments for documentation
COMMENT ON TABLE simulations IS 'Stores simulation results and summary data for rocket flights';
COMMENT ON TABLE simulation_telemetry IS 'Stores detailed telemetry data (trajectory points) for simulations';

COMMENT ON COLUMN simulations.rocket_config IS 'Snapshot of rocket configuration used for this simulation';
COMMENT ON COLUMN simulations.results IS 'Complete flight results including all performance metrics';
COMMENT ON COLUMN simulations.weather IS 'Weather conditions used in simulation';
COMMENT ON COLUMN simulations.launch_options IS 'Launch options and parameters used';
COMMENT ON COLUMN simulations.max_altitude IS 'Maximum altitude reached (meters AGL) - denormalized for performance';
COMMENT ON COLUMN simulations.max_velocity IS 'Maximum velocity reached (m/s) - denormalized for performance';
COMMENT ON COLUMN simulations.flight_time IS 'Total flight time (seconds) - denormalized for performance';
COMMENT ON COLUMN simulations.successful IS 'Whether the flight was successful (no critical failures)';
COMMENT ON COLUMN simulations.score IS 'Overall performance score (0-100)';

COMMENT ON COLUMN simulation_telemetry.telemetry_data IS 'Array of trajectory points with position, velocity, acceleration data';
COMMENT ON COLUMN simulation_telemetry.time_step IS 'Time step used in simulation (seconds)';
COMMENT ON COLUMN simulation_telemetry.total_points IS 'Number of trajectory points in telemetry data';
COMMENT ON COLUMN simulation_telemetry.data_size_kb IS 'Size of telemetry data in KB for storage monitoring';

-- Sample data structures (for documentation)
/*
Example results JSONB structure:
{
  "maxAltitude": 245.7,
  "maxVelocity": 89.3,
  "maxAcceleration": 156.2,
  "flightTime": 18.4,
  "burnoutAltitude": 78.2,
  "burnoutVelocity": 67.1,
  "apogeeTime": 6.8,
  "recoveryTime": 8.2,
  "landingDistance": 125.3,
  "maxMachNumber": 0.26,
  "maxDynamicPressure": 1247.8,
  "stabilityMargin": 2.3,
  "successful": true,
  "issues": [],
  "score": 87
}

Example weather JSONB structure:
{
  "temperature": 20,
  "pressure": 101325,
  "humidity": 50,
  "windSpeed": 5,
  "windDirection": 45,
  "windGustSpeed": 8
}

Example telemetry_data JSONB structure:
[
  {
    "time": 0.0,
    "position": {"x": 0, "y": 0, "z": 0},
    "velocity": {"x": 0, "y": 0, "z": 0},
    "acceleration": {"x": 0, "y": 156.2, "z": 0},
    "mass": 0.162,
    "thrust": 12.0,
    "drag": 0.1,
    "machNumber": 0.0,
    "altitude": 0,
    "phase": "boost"
  },
  ...
]
*/

-- Create function to calculate telemetry data size
CREATE OR REPLACE FUNCTION calculate_telemetry_size()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_size_kb = (octet_length(NEW.telemetry_data::text) / 1024)::integer;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate telemetry data size
CREATE TRIGGER simulation_telemetry_size_trigger
    BEFORE INSERT OR UPDATE ON simulation_telemetry
    FOR EACH ROW
    EXECUTE FUNCTION calculate_telemetry_size();
