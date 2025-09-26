-- Migration: Create users table
-- Description: Core user accounts with authentication and profile data
-- Version: 001
-- Created: 2024-01-01

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE user_role AS ENUM ('child', 'parent', 'admin');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(254) NOT NULL UNIQUE,
    username VARCHAR(30) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar TEXT,
    date_of_birth DATE,
    parent_email VARCHAR(254),
    role user_role NOT NULL DEFAULT 'child',
    is_email_verified BOOLEAN NOT NULL DEFAULT false,
    
    -- Password reset fields
    password_reset_token VARCHAR(64),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    
    -- Email verification fields
    email_verification_token VARCHAR(64),
    email_verification_expires TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_parent_email ON users(parent_email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_password_reset_token ON users(password_reset_token) WHERE password_reset_token IS NOT NULL;
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token) WHERE email_verification_token IS NOT NULL;

-- Create partial index for active users
CREATE INDEX idx_users_active ON users(id, email, username) WHERE deleted_at IS NULL;

-- Add constraints
ALTER TABLE users ADD CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
ALTER TABLE users ADD CONSTRAINT chk_username_format CHECK (username ~* '^[a-zA-Z0-9]+$');
ALTER TABLE users ADD CONSTRAINT chk_username_length CHECK (LENGTH(username) >= 3);
ALTER TABLE users ADD CONSTRAINT chk_display_name_length CHECK (LENGTH(display_name) >= 1);
ALTER TABLE users ADD CONSTRAINT chk_password_length CHECK (LENGTH(password) >= 8);
ALTER TABLE users ADD CONSTRAINT chk_date_of_birth CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE);
ALTER TABLE users ADD CONSTRAINT chk_parent_email_format CHECK (parent_email IS NULL OR parent_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE users IS 'Core user accounts with authentication and profile information';
COMMENT ON COLUMN users.id IS 'Unique identifier for the user';
COMMENT ON COLUMN users.email IS 'User email address (unique, used for login)';
COMMENT ON COLUMN users.username IS 'User chosen username (unique, alphanumeric only)';
COMMENT ON COLUMN users.display_name IS 'Display name shown to other users';
COMMENT ON COLUMN users.password IS 'Bcrypt hashed password';
COMMENT ON COLUMN users.avatar IS 'URL to user avatar image';
COMMENT ON COLUMN users.date_of_birth IS 'User date of birth (for age verification and COPPA compliance)';
COMMENT ON COLUMN users.parent_email IS 'Parent email for users under 13 (COPPA compliance)';
COMMENT ON COLUMN users.role IS 'User role determining permissions';
COMMENT ON COLUMN users.is_email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.password_reset_token IS 'Token for password reset (temporary)';
COMMENT ON COLUMN users.password_reset_expires IS 'Expiration time for password reset token';
COMMENT ON COLUMN users.email_verification_token IS 'Token for email verification (temporary)';
COMMENT ON COLUMN users.email_verification_expires IS 'Expiration time for email verification token';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp (NULL = not deleted)';

-- Create user profiles table (extended user information)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    favorite_rockets TEXT[], -- Array of rocket IDs
    achievements JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{
        "theme": "auto",
        "language": "en",
        "notifications": {
            "email": true,
            "push": true,
            "achievements": true,
            "missions": true
        },
        "privacy": {
            "showProfile": true,
            "shareDesigns": true
        }
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for user profiles
CREATE UNIQUE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_created_at ON user_profiles(created_at);

-- Add trigger for user profiles updated_at
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for user profiles
COMMENT ON TABLE user_profiles IS 'Extended user profile information and preferences';
COMMENT ON COLUMN user_profiles.bio IS 'User biography/description';
COMMENT ON COLUMN user_profiles.favorite_rockets IS 'Array of favorite rocket design IDs';
COMMENT ON COLUMN user_profiles.achievements IS 'JSON array of user achievements';
COMMENT ON COLUMN user_profiles.preferences IS 'JSON object containing user preferences';

-- Create function to automatically create user profile
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to create profile when user is created
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- Grant permissions (adjust as needed for your environment)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON users TO kidrocket_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO kidrocket_app;
-- GRANT USAGE ON SEQUENCE users_id_seq TO kidrocket_app;
-- GRANT USAGE ON SEQUENCE user_profiles_id_seq TO kidrocket_app;
