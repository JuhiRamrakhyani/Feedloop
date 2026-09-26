-- Two starter templates, matching the retail / wholesale split.

INSERT INTO feedback_templates (name, description) VALUES
    ('Retail bookseller feedback', 'Default feedback form for retail booksellers'),
    ('Wholesale distributor feedback', 'Feedback form for wholesale / bulk dispatch partners');

INSERT INTO feedback_questions (template_id, label, field_type, options, is_required, sort_order) VALUES
    (1, 'Overall experience with this delivery', 'rating', NULL, true, 1),
    (1, 'Was the order delivered on time?', 'radio',
        '[{"value":"early","label":"Early"},{"value":"ontime","label":"On time"},{"value":"late","label":"Late"}]',
        true, 2),
    (1, 'Which issues, if any, did you notice?', 'checkbox',
        '[{"value":"damaged","label":"Damaged packaging"},{"value":"missing","label":"Missing items"},{"value":"wrong","label":"Wrong titles"},{"value":"invoice","label":"Invoice mismatch"}]',
        false, 3),
    (1, 'Anything you would like AGP to know?', 'textarea', NULL, true, 4);

INSERT INTO feedback_questions (template_id, label, field_type, options, is_required, min_value, max_value, sort_order) VALUES
    (2, 'Overall experience with this dispatch', 'rating', NULL, true, 1, 5, 1);
INSERT INTO feedback_questions (template_id, label, field_type, options, is_required, sort_order) VALUES
    (2, 'How would you rate order accuracy across this batch?', 'radio',
        '[{"value":"fully_accurate","label":"Fully accurate"},{"value":"minor_issues","label":"Minor issues"},{"value":"major_issues","label":"Major issues"}]',
        true, 2),
    (2, 'Units short or excess (if any)', 'number', NULL, false, 3),
    (2, 'Additional remarks', 'textarea', NULL, false, 4);
