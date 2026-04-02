-- profiles テーブル
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text default 'JPY',
  created_at timestamptz default now()
);

-- transactions テーブル
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('income', 'expense', 'saving', 'investment')),
  amount integer not null check (amount > 0),
  category text not null,
  memo text default '',
  payment_method text default 'カード',
  is_fixed boolean default false,
  date date not null,
  created_at timestamptz default now()
);

-- budgets テーブル
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null,
  amount integer not null,
  month text not null,
  created_at timestamptz default now(),
  unique(user_id, category, month)
);

-- ======================================
-- RLS (Row Level Security) 設定
-- ======================================

alter table profiles enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;

-- profiles ポリシー
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;

create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- transactions ポリシー
drop policy if exists "Users can view own transactions" on transactions;
drop policy if exists "Users can insert own transactions" on transactions;
drop policy if exists "Users can update own transactions" on transactions;
drop policy if exists "Users can delete own transactions" on transactions;

create policy "Users can view own transactions" on transactions
  for select using (auth.uid() = user_id);

create policy "Users can insert own transactions" on transactions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own transactions" on transactions
  for update using (auth.uid() = user_id);

create policy "Users can delete own transactions" on transactions
  for delete using (auth.uid() = user_id);

-- budgets ポリシー
drop policy if exists "Users can view own budgets" on budgets;
drop policy if exists "Users can insert own budgets" on budgets;
drop policy if exists "Users can update own budgets" on budgets;
drop policy if exists "Users can delete own budgets" on budgets;

create policy "Users can view own budgets" on budgets
  for select using (auth.uid() = user_id);

create policy "Users can insert own budgets" on budgets
  for insert with check (auth.uid() = user_id);

create policy "Users can update own budgets" on budgets
  for update using (auth.uid() = user_id);

create policy "Users can delete own budgets" on budgets
  for delete using (auth.uid() = user_id);

-- ======================================
-- インデックス（パフォーマンス最適化）
-- ======================================

create index if not exists idx_transactions_user_date
  on transactions(user_id, date desc);

create index if not exists idx_transactions_user_type
  on transactions(user_id, type);

create index if not exists idx_budgets_user_month
  on budgets(user_id, month);
