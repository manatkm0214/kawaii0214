import Dashboard from '../../lib/components/Dashboard';

export default function DashboardPage() {
  // ダミーデータ（開発・デザイン確認用）
  const dummyTransactions: Transaction[] = [
    {
      id: "1",
      user_id: "demo-user",
      type: "income",
      amount: 300000,
      category: "給与",
      memo: "給与4月分",
      payment_method: "口座振替",
      is_fixed: false,
      date: "2026-04-01",
      created_at: "2026-04-01T00:00:00Z"
    },
    {
      id: "2",
      user_id: "demo-user",
      type: "expense",
      amount: 220000,
      category: "生活費",
      memo: "家賃・光熱費等",
      payment_method: "カード",
      is_fixed: true,
      date: "2026-04-02",
      created_at: "2026-04-02T00:00:00Z"
    },
    {
      id: "3",
      user_id: "demo-user",
      type: "saving",
      amount: 50000,
      category: "貯金",
      memo: "先取り貯金",
      payment_method: "口座振替",
      is_fixed: false,
      date: "2026-04-03",
      created_at: "2026-04-03T00:00:00Z"
    },
    {
      id: "4",
      user_id: "demo-user",
      type: "investment",
      amount: 10000,
      category: "投資",
      memo: "つみたてNISA",
      payment_method: "口座振替",
      is_fixed: false,
      date: "2026-04-04",
      created_at: "2026-04-04T00:00:00Z"
    },
  ];
  const dummyBudgets = [
    {
      id: "1",
      user_id: "demo-user",
      category: "生活費",
      amount: 220000,
      month: "2026-04",
      created_at: "2026-03-25T00:00:00Z"
    },
    {
      id: "2",
      user_id: "demo-user",
      category: "貯金",
      amount: 50000,
      month: "2026-04",
      created_at: "2026-03-25T00:00:00Z"
    },
  ];
  const dummyProfile = {
    id: "demo-user",
    display_name: "ユーザー さん",
    currency: "JPY",
    allocation_take_home: 300000,
    allocation_target_fixed_rate: 40,
    allocation_target_variable_rate: 20,
    allocation_target_savings_rate: 20,
    created_at: "2026-01-01T00:00:00Z"
  };
  const currentMonth = "2026-04";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 px-4 w-full">
      <div className="w-full max-w-7xl mx-auto">
        <Dashboard
          transactions={dummyTransactions}
          budgets={dummyBudgets}
          currentMonth={currentMonth}
          profile={dummyProfile}
        />
      </div>
    </div>
  );
}

export type TransactionType = "income" | "expense" | "saving" | "investment";

export type Transaction = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  memo: string;
  payment_method: string;
  is_fixed: boolean;
  date: string;
  created_at: string;
};

export type Budget = {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  month: string;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string;
  currency: string;
  allocation_take_home: number;
  allocation_target_fixed_rate: number;
  allocation_target_variable_rate: number;
  allocation_target_savings_rate: number;
  created_at: string;
};