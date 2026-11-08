CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY,
  question text NOT NULL CHECK (length(question) > 0),
  active boolean NOT NULL DEFAULT true
);

-- Upgrade existing databases without changing poll data or vote constraints.
DROP INDEX IF EXISTS one_active_poll;

CREATE TABLE IF NOT EXISTS poll_options (
  id uuid PRIMARY KEY,
  poll_id uuid NOT NULL REFERENCES polls(id),
  label text NOT NULL CHECK (length(label) > 0),
  display_order integer NOT NULL,
  UNIQUE (poll_id, id),
  UNIQUE (poll_id, display_order)
);

CREATE TABLE IF NOT EXISTS votes (
  poll_id uuid NOT NULL REFERENCES polls(id),
  option_id uuid NOT NULL,
  user_id text NOT NULL CHECK (user_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_vote_per_user UNIQUE (poll_id, user_id),
  FOREIGN KEY (poll_id, option_id) REFERENCES poll_options(poll_id, id)
);

CREATE INDEX IF NOT EXISTS votes_by_option ON votes (poll_id, option_id);
