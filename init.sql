CREATE TABLE audio_segments (
    id SERIAL PRIMARY KEY,
    original_file_id TEXT NOT NULL,
    segment_file_id UUID NOT NULL,
    segment_start_time INT NOT NULL,
    segment_duration INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
