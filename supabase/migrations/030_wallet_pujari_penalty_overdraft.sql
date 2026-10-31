-- Pujari cancel and no-show penalties may take a wallet below zero (the pujari then owes
-- the platform). apply_wallet still refuses negative balances for every other change.
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_balance_paise_check;
