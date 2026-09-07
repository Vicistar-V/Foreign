-- Add Victor Ogazie as admin
INSERT INTO user_roles (user_id, role)
VALUES ('9ccc8705-fcdd-4706-9127-4df53bedb442', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;