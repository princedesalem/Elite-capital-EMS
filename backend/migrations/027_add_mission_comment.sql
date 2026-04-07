-- Migration 027: Add mission_comment column to Mission table
-- Allows attaching a comment/titre to mission creation requests

ALTER TABLE Mission ADD COLUMN IF NOT EXISTS mission_comment VARCHAR(512) DEFAULT NULL;
