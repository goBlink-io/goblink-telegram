-- Add referral tracking columns to tg_users
ALTER TABLE tg_users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES tg_users(id);

-- Index for referral code lookups
CREATE INDEX IF NOT EXISTS idx_tg_users_referral_code ON tg_users(referral_code) WHERE referral_code IS NOT NULL;

-- Index for counting referrals per user
CREATE INDEX IF NOT EXISTS idx_tg_users_referred_by ON tg_users(referred_by) WHERE referred_by IS NOT NULL;

-- Generate referral codes for existing users that don't have one
UPDATE tg_users
SET referral_code = LOWER(SUBSTR(MD5(id::text || created_at::text), 1, 8))
WHERE referral_code IS NULL;
