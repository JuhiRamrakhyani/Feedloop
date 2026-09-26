-- AGP feedback service — PostgreSQL schema
-- This database owns everything: identity master data, templates, requests,
-- and responses. Requests still store a point-in-time snapshot of the
-- identity fields so review never needs a live join.

CREATE TABLE feedback_templates (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    description VARCHAR(300),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- field_type: rating | radio | checkbox | text | textarea | number
CREATE TABLE feedback_questions (
    id           SERIAL PRIMARY KEY,
    template_id  INT NOT NULL REFERENCES feedback_templates(id) ON DELETE CASCADE,
    label        VARCHAR(300) NOT NULL,
    help_text    VARCHAR(300),
    field_type   VARCHAR(20) NOT NULL
                   CHECK (field_type IN ('rating','radio','checkbox','text','textarea','number')),
    options      JSONB,                -- [{"value":"early","label":"Early"}, ...] for radio/checkbox
    is_required  BOOLEAN NOT NULL DEFAULT false,
    min_length   INT,
    max_length   INT,
    min_value    INT,
    max_value    INT,
    sort_order   INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_feedback_questions_template ON feedback_questions(template_id);

CREATE TABLE feedback_requests (
    id             SERIAL PRIMARY KEY,
    request_uuid   VARCHAR(40) NOT NULL UNIQUE,  -- short random token the link points to
    template_id    INT NOT NULL REFERENCES feedback_templates(id),

    -- snapshot of the recipient at send time. identity_id is nullable so you
    -- can send to a raw phone number that isn't in the identities table.
    identity_id    INT,
    name           VARCHAR(200) NOT NULL,
    state          VARCHAR(100),
    city           VARCHAR(100),
    company        VARCHAR(200),
    mobile_number  VARCHAR(20) NOT NULL,
    software       VARCHAR(20),              -- adc | sanchar | tdc (identity source)

    status         VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending|sent|viewed|completed|expired
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at        TIMESTAMPTZ,
    viewed_at      TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days')
);

CREATE INDEX idx_feedback_requests_identity ON feedback_requests(identity_id);
CREATE INDEX idx_feedback_requests_status ON feedback_requests(status);
CREATE INDEX idx_feedback_requests_created ON feedback_requests(created_at);

CREATE TABLE feedback_answers (
    id            SERIAL PRIMARY KEY,
    request_id    INT NOT NULL REFERENCES feedback_requests(id) ON DELETE CASCADE,
    question_id   INT NOT NULL REFERENCES feedback_questions(id),
    answer_value  TEXT NOT NULL,        -- checkbox stores a JSON array as text
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_answers_request ON feedback_answers(request_id);

-- Identity master data. Standalone local table so search & send work
-- without any external API or SQL Server.
CREATE TABLE IF NOT EXISTS identities (
    identity_id   INT PRIMARY KEY,
    name          VARCHAR(200) NOT NULL,
    state         VARCHAR(100),
    city          VARCHAR(100),
    company       VARCHAR(200),
    mobile_number VARCHAR(20),
    category      VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_identities_name ON identities(name);

-- Convenience view for the review/list screen
CREATE VIEW vw_feedback_review AS
SELECT
    r.id, r.request_uuid, r.identity_id, r.name, r.company, r.state, r.city,
    r.mobile_number, r.software, r.status, r.created_at, r.completed_at,
    t.name AS template_name,
    (SELECT COUNT(*) FROM feedback_answers a WHERE a.request_id = r.id) AS answer_count
FROM feedback_requests r
JOIN feedback_templates t ON t.id = r.template_id;
