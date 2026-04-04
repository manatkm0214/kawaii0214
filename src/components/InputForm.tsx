"use client";
import React, { useState } from 'react';

const categories = [
  '食費', '日用品', '交通', '交際', '趣味', '教育', '医療', '光熱費', '家賃', '通信', '保険', '貯金', '投資', 'その他'
];
const paymentMethods = [
  '現金', 'カード', '振替', 'PayPay', '楽天Pay'
];
const units = ['円', '千円', '万円'];

export default function InputForm() {
  const [tab, setTab] = useState<'収入' | '支出' | '貯金' | '投資' | '固定費'>('支出');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('円');
  const [category, setCategory] = useState(categories[0]);
  const [payment, setPayment] = useState(paymentMethods[0]);
  const [memo, setMemo] = useState('');
  const [isFixed, setIsFixed] = useState(false);

  return (
    <div className="bg-slate-900/70 rounded-xl p-6 max-w-xl mx-auto mt-8 w-full">
      <div className="flex gap-2 mb-4">
        {['収入', '支出', '貯金', '投資', '固定費'].map((t) => (
          <button
            key={t}
            className={`px-3 py-1 rounded-full text-sm font-semibold transition ${tab === t ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            onClick={() => setTab(t as '収入' | '支出' | '貯金' | '投資' | '固定費')}
          >
            {t}
          </button>
        ))}
      </div>
      <form className="space-y-4">
        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="金額"
            className="w-32 px-3 py-2 rounded bg-slate-800 text-white border border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <select value={unit} onChange={e => setUnit(e.target.value)} className="px-2 py-2 rounded bg-slate-800 text-white border border-slate-700">
            {units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <select value={category} onChange={e => setCategory(e.target.value)} className="flex-1 px-2 py-2 rounded bg-slate-800 text-white border border-slate-700">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={payment} onChange={e => setPayment(e.target.value)} className="flex-1 px-2 py-2 rounded bg-slate-800 text-white border border-slate-700">
            {paymentMethods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <input
          type="text"
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="メモ（任意）"
          className="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-700"
        />
        <div className="flex items-center gap-2">
          <input type="checkbox" id="fixed" checked={isFixed} onChange={e => setIsFixed(e.target.checked)} />
          <label htmlFor="fixed" className="text-slate-400 text-sm">毎月の固定費として扱う</label>
        </div>
        <button
          type="submit"
          className="w-full py-2 mt-2 rounded bg-violet-600 hover:bg-violet-700 text-white font-bold transition"
        >
          登録
        </button>
      </form>
    </div>
  );
}
