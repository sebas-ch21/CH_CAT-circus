/*
  # Add Demo Users

  1. Demo Users
    - Admin account for testing admin panel
    - Manager account for testing dispatch center
    - IC accounts with different tier ranks for testing queue

  These are test users for the V1 prototype.
*/

INSERT INTO users (email, role, tier_rank, status) VALUES
  ('admin@clinic.com', 'Admin', 1, 'Available'),
  ('manager@clinic.com', 'Manager', 1, 'Available'),
  ('ic1@clinic.com', 'IC', 1, 'Available'),
  ('ic2@clinic.com', 'IC', 2, 'Available'),
  ('ic3@clinic.com', 'IC', 3, 'Available'),
  ('ic4@clinic.com', 'IC', 1, 'Available'),
  ('ic5@clinic.com', 'IC', 2, 'Available')
ON CONFLICT (email) DO NOTHING;
