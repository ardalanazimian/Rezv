-- 046: default SMS balance for NEW restaurants = 50
-- Does not change existing restaurant balances.

ALTER TABLE restaurants
  ALTER COLUMN sms_balance SET DEFAULT 50;
