-- upay schema (PostgreSQL 14+). Money is NUMERIC(14,2); all times are epoch milliseconds (bigint).
-- The CHECK constraints are the last line of defence: even a bug in the code cannot create negative money.

CREATE TABLE IF NOT EXISTS wallets (
  uid               text PRIMARY KEY,
  name              text    NOT NULL,
  phone             text    NOT NULL UNIQUE,
  balance           numeric(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  frozen            boolean NOT NULL DEFAULT false,
  acct              text    NOT NULL DEFAULT 'personal' CHECK (acct IN ('personal','student','islamic')),
  student_ok        boolean NOT NULL DEFAULT false,      -- only admin approval sets this
  pin_hash          text,
  pin_salt          text,
  pin_fails         int     NOT NULL DEFAULT 0,
  pin_locked_until  bigint  NOT NULL DEFAULT 0,
  guardian_uid      text    REFERENCES wallets(uid) ON DELETE SET NULL,
  guardian_status   text    NOT NULL DEFAULT '' CHECK (guardian_status IN ('','pending','ok')),
  guardian_seen_at  bigint  NOT NULL DEFAULT 0,
  guardian_seen_by  text    NOT NULL DEFAULT '',
  guardian_seen_ack bigint  NOT NULL DEFAULT 0,
  undos             jsonb   NOT NULL DEFAULT '[]'::jsonb,
  created_at        bigint  NOT NULL
);

-- student money buckets. Invariant (enforced in code): sum(buckets) <= wallets.balance
CREATE TABLE IF NOT EXISTS buckets (
  uid    text NOT NULL REFERENCES wallets(uid) ON DELETE CASCADE,
  name   text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  PRIMARY KEY (uid, name)
);

CREATE TABLE IF NOT EXISTS saved_accounts (
  uid   text NOT NULL REFERENCES wallets(uid) ON DELETE CASCADE,
  phone text NOT NULL,
  name  text NOT NULL DEFAULT '',
  PRIMARY KEY (uid, phone)
);

-- auto transfer rules: sent by the server scheduler, even when the app is closed
CREATE TABLE IF NOT EXISTS rules (
  id      bigserial PRIMARY KEY,
  uid     text NOT NULL REFERENCES wallets(uid) ON DELETE CASCADE,
  phone   text NOT NULL,
  name    text NOT NULL DEFAULT '',
  amount  numeric(14,2) NOT NULL CHECK (amount > 0),
  run_at  bigint  NOT NULL DEFAULT 0,        -- 0 = any time
  repeat  boolean NOT NULL DEFAULT false,    -- monthly
  armed   boolean NOT NULL DEFAULT false,    -- armed when money arrives (or at creation for repeating rules)
  done_at bigint,
  last_at bigint
);
CREATE INDEX IF NOT EXISTS rules_due ON rules (run_at) WHERE armed AND done_at IS NULL;

CREATE TABLE IF NOT EXISTS txs (
  id                text PRIMARY KEY,
  uid               text NOT NULL REFERENCES wallets(uid) ON DELETE CASCADE,
  kind              text NOT NULL,           -- send, receive, cashout, recharge, bill, payment, fund, split, auto_send, admin, ...
  amount            numeric(14,2) NOT NULL,  -- signed, includes the fee when negative
  fee               numeric(14,2) NOT NULL DEFAULT 0,
  balance_after     numeric(14,2) NOT NULL,
  ts                bigint NOT NULL,
  counterparty_phone text NOT NULL DEFAULT '',
  counterparty_name  text NOT NULL DEFAULT '',
  trx_id            text NOT NULL DEFAULT '',
  bucket            text NOT NULL DEFAULT '',
  peer_uid          text,
  peer_tx_id        text,
  undone            boolean NOT NULL DEFAULT false,
  auto              boolean NOT NULL DEFAULT false,
  idem_key          text
);
CREATE INDEX IF NOT EXISTS txs_uid_ts ON txs (uid, ts DESC);
CREATE INDEX IF NOT EXISTS txs_trx ON txs (trx_id);
-- the same client retry can never charge twice
CREATE UNIQUE INDEX IF NOT EXISTS txs_idem ON txs (uid, idem_key) WHERE idem_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS splits (
  id       text PRIMARY KEY,
  from_uid text NOT NULL REFERENCES wallets(uid) ON DELETE CASCADE,
  to_uid   text NOT NULL REFERENCES wallets(uid) ON DELETE CASCADE,
  amount   numeric(14,2) NOT NULL CHECK (amount > 0),
  total    numeric(14,2) NOT NULL,
  note     text NOT NULL DEFAULT '',
  status   text NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','declined')),
  ts       bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS splits_to ON splits (to_uid, status);

-- support side (chats, emails, complaints, FAQs, student applications, announcements): schemaless documents
CREATE TABLE IF NOT EXISTS docs (
  collection text NOT NULL,
  id         text NOT NULL,
  owner_uid  text,
  data       jsonb NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS docs_owner ON docs (collection, owner_uid);

-- sign-up details (NID is stored as a keyed hash + last 4 digits only)
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS nid_hash  text;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS nid_last4 text;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS dob       text;
CREATE UNIQUE INDEX IF NOT EXISTS wallets_nid_uq ON wallets(nid_hash) WHERE nid_hash IS NOT NULL;

-- per-customer settings that must follow the customer to a new phone: favourites, profile photo, reminders, saved billers
CREATE TABLE IF NOT EXISTS prefs (
  uid        text NOT NULL REFERENCES wallets(uid) ON DELETE CASCADE,
  key        text NOT NULL,
  value      jsonb NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY (uid, key)
);

-- who froze a wallet: 'self' (customer, with PIN) or 'admin'. Only an admin can unfreeze.
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS frozen_by text   NOT NULL DEFAULT '';
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS frozen_at bigint NOT NULL DEFAULT 0;
