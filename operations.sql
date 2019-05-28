USE database1;
SELECT id, name, address FROM users WHERE is_customer IS NOT NULL ORDER BY created;
INSERT INTO user_notes (id, user_id, note, created) VALUES (1, 1, "Note 1", NOW());
DELETE FROM database2.logs WHERE id < 1000;
