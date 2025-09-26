-- Migration: Create user sessions table
-- Description: User session management for authentication and security tracking
-- Version: 002
-- Created: 2024-01-01

-- Create enum for device types
CREATE TYPE device_type AS ENUM ('desktop', 'mobile', 'tablet');

-- Create user_sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Device information
    device_type device_type NOT NULL,
    device_os VARCHAR(50) NOT NULL,
    device_browser VARCHAR(50) NOT NULL,
    device_fingerprint VARCHAR(32) NOT NULL,
    
    -- Session tracking
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    
    -- Session lifecycle
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create indexes for performance
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, is_active, expires_at) WHERE is_active = true;
CREATE INDEX idx_user_sessions_ip_address ON user_sessions(ip_address);
CREATE INDEX idx_user_sessions_device_fingerprint ON user_sessions(device_fingerprint);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_created_at ON user_sessions(created_at);
CREATE INDEX idx_user_sessions_last_accessed ON user_sessions(last_accessed_at);

-- Create composite indexes for common queries
CREATE INDEX idx_user_sessions_cleanup ON user_sessions(expires_at, is_active, last_accessed_at);
CREATE INDEX idx_user_sessions_security ON user_sessions(ip_address, user_id, device_fingerprint) WHERE is_active = true;

-- Add constraints
ALTER TABLE user_sessions ADD CONSTRAINT chk_expires_at_future CHECK (expires_at > created_at);
ALTER TABLE user_sessions ADD CONSTRAINT chk_last_accessed_after_created CHECK (last_accessed_at >= created_at);
ALTER TABLE user_sessions ADD CONSTRAINT chk_device_fingerprint_length CHECK (LENGTH(device_fingerprint) = 16);

-- Add comments for documentation
COMMENT ON TABLE user_sessions IS 'User authentication sessions with device and security tracking';
COMMENT ON COLUMN user_sessions.id IS 'Unique session identifier (used in refresh tokens)';
COMMENT ON COLUMN user_sessions.user_id IS 'Reference to the user who owns this session';
COMMENT ON COLUMN user_sessions.device_type IS 'Type of device (desktop, mobile, tablet)';
COMMENT ON COLUMN user_sessions.device_os IS 'Operating system of the device';
COMMENT ON COLUMN user_sessions.device_browser IS 'Browser used for the session';
COMMENT ON COLUMN user_sessions.device_fingerprint IS 'Unique device fingerprint for security';
COMMENT ON COLUMN user_sessions.ip_address IS 'IP address from which the session was created';
COMMENT ON COLUMN user_sessions.user_agent IS 'Full user agent string';
COMMENT ON COLUMN user_sessions.created_at IS 'When the session was created';
COMMENT ON COLUMN user_sessions.last_accessed_at IS 'When the session was last used';
COMMENT ON COLUMN user_sessions.expires_at IS 'When the session expires';
COMMENT ON COLUMN user_sessions.is_active IS 'Whether the session is currently active';

-- Create session activity log table for detailed tracking
CREATE TABLE session_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    activity_data JSONB,
    ip_address INET NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for session activities
CREATE INDEX idx_session_activities_session_id ON session_activities(session_id);
CREATE INDEX idx_session_activities_type ON session_activities(activity_type);
CREATE INDEX idx_session_activities_created_at ON session_activities(created_at);
CREATE INDEX idx_session_activities_ip_address ON session_activities(ip_address);

-- Add constraints for session activities
ALTER TABLE session_activities ADD CONSTRAINT chk_activity_type_not_empty CHECK (LENGTH(activity_type) > 0);

-- Add comments for session activities
COMMENT ON TABLE session_activities IS 'Detailed log of session activities for security monitoring';
COMMENT ON COLUMN session_activities.session_id IS 'Reference to the session';
COMMENT ON COLUMN session_activities.activity_type IS 'Type of activity (login, logout, token_refresh, etc.)';
COMMENT ON COLUMN session_activities.activity_data IS 'Additional activity-specific data as JSON';
COMMENT ON COLUMN session_activities.ip_address IS 'IP address for this specific activity';
COMMENT ON COLUMN session_activities.user_agent IS 'User agent for this specific activity';

-- Create function to log session activities
CREATE OR REPLACE FUNCTION log_session_activity(
    p_session_id UUID,
    p_activity_type VARCHAR(50),
    p_activity_data JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO session_activities (
        session_id, activity_type, activity_data, ip_address, user_agent
    ) VALUES (
        p_session_id, p_activity_type, p_activity_data, p_ip_address, p_user_agent
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old sessions and activities
CREATE OR REPLACE FUNCTION cleanup_old_sessions() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired sessions and their activities
    WITH deleted_sessions AS (
        DELETE FROM user_sessions 
        WHERE expires_at < NOW() 
           OR (is_active = false AND last_accessed_at < NOW() - INTERVAL '7 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted_sessions;
    
    -- Delete old session activities (keep for 30 days)
    DELETE FROM session_activities 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to detect suspicious session activity
CREATE OR REPLACE FUNCTION detect_suspicious_sessions()
RETURNS TABLE (
    user_id UUID,
    suspicious_reason TEXT,
    session_count BIGINT,
    ip_addresses TEXT[],
    device_fingerprints TEXT[]
) AS $$
BEGIN
    -- Multiple active sessions from different IPs
    RETURN QUERY
    SELECT 
        s.user_id,
        'Multiple IPs' as suspicious_reason,
        COUNT(*)::BIGINT as session_count,
        ARRAY_AGG(DISTINCT s.ip_address::TEXT) as ip_addresses,
        ARRAY_AGG(DISTINCT s.device_fingerprint) as device_fingerprints
    FROM user_sessions s
    WHERE s.is_active = true 
      AND s.expires_at > NOW()
    GROUP BY s.user_id
    HAVING COUNT(DISTINCT s.ip_address) > 2
       AND COUNT(*) > 1;
    
    -- Too many concurrent sessions
    RETURN QUERY
    SELECT 
        s.user_id,
        'Too many sessions' as suspicious_reason,
        COUNT(*)::BIGINT as session_count,
        ARRAY_AGG(DISTINCT s.ip_address::TEXT) as ip_addresses,
        ARRAY_AGG(DISTINCT s.device_fingerprint) as device_fingerprints
    FROM user_sessions s
    WHERE s.is_active = true 
      AND s.expires_at > NOW()
    GROUP BY s.user_id
    HAVING COUNT(*) > 5;
    
    -- Multiple devices from same IP (potential account sharing)
    RETURN QUERY
    SELECT 
        s.user_id,
        'Multiple devices same IP' as suspicious_reason,
        COUNT(*)::BIGINT as session_count,
        ARRAY_AGG(DISTINCT s.ip_address::TEXT) as ip_addresses,
        ARRAY_AGG(DISTINCT s.device_fingerprint) as device_fingerprints
    FROM user_sessions s
    WHERE s.is_active = true 
      AND s.expires_at > NOW()
    GROUP BY s.user_id, s.ip_address
    HAVING COUNT(DISTINCT s.device_fingerprint) > 3;
END;
$$ LANGUAGE plpgsql;

-- Create view for active sessions summary
CREATE VIEW active_sessions_summary AS
SELECT 
    us.user_id,
    u.email,
    u.username,
    COUNT(*) as active_session_count,
    MAX(us.last_accessed_at) as last_activity,
    ARRAY_AGG(DISTINCT us.device_type::TEXT) as device_types,
    ARRAY_AGG(DISTINCT us.ip_address::TEXT) as ip_addresses
FROM user_sessions us
JOIN users u ON us.user_id = u.id
WHERE us.is_active = true 
  AND us.expires_at > NOW()
  AND u.deleted_at IS NULL
GROUP BY us.user_id, u.email, u.username;

-- Add comment for the view
COMMENT ON VIEW active_sessions_summary IS 'Summary of active sessions per user for monitoring';

-- Create indexes for the functions
CREATE INDEX idx_user_sessions_suspicious_detection ON user_sessions(user_id, is_active, expires_at, ip_address, device_fingerprint) WHERE is_active = true;

-- Grant permissions (adjust as needed for your environment)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO kidrocket_app;
-- GRANT SELECT, INSERT, DELETE ON session_activities TO kidrocket_app;
-- GRANT SELECT ON active_sessions_summary TO kidrocket_app;
-- GRANT EXECUTE ON FUNCTION log_session_activity TO kidrocket_app;
-- GRANT EXECUTE ON FUNCTION cleanup_old_sessions TO kidrocket_app;
-- GRANT EXECUTE ON FUNCTION detect_suspicious_sessions TO kidrocket_app;
