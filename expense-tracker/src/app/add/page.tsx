'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Cat = { id: number; name: string }

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true'
const DEV_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID!

const DEFAULTS = [
  'Food & Dining','Groceries','Shopping','Transport','Bills & Utilities',
  'Subscriptions','Health','Entertainment/Outing','Drinking','Investments',
  'Given to Mom','Misc'
]

async function getActiveUserId(): Promise<string> {
  if (DEV_MODE && DEV_USER_ID) return DEV_USER_ID
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Not signed in')
  return data.user.id
}

async function seedIfEmpty() {
  const userId = await getActiveUserId()
  const { data, error } = await supabase.from('categories').select('id').eq('user_id', userId).limit(1)
  if (error) throw error
  if (data && data.length > 0) return false
  const rows = DEFAULTS.map(name => ({ user_id: userId, name, kind: 'expense', is_default: true }))
  const { error: insErr } = await supabase.from('categories').insert(rows)
  if (insErr) throw insErr
  return true
}

export default function AddPage() {
  const [cats, setCats] = useState<Cat[]>([])
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10))
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [method, setMethod] = useState<'UPI'|'Card'|'Cash'|'Other'>('UPI')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [needSeed, setNeedSeed] = useState(false)

  async function loadCats() {
    try {
      const userId = await getActiveUserId()
      const { data, error } = await supabase.from('categories').select('id,name').eq('user_id', userId).order('name')
      if (error) throw error
      setCats(data || [])
      setNeedSeed(!data || data.length === 0)
    } catch (e:any) {
      setMsg(e.message)
    }
  }

  useEffect(() => { (async () => {
    try { await seedIfEmpty() } catch {}
    await loadCats()
  })() }, [])

  async function seedNow() {
    setMsg(null)
    try { await seedIfEmpty(); await loadCats(); setMsg('Default categories added ✓') }
    catch (e:any) { setMsg(e.message) }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    try {
      const userId = await getActiveUserId()
      if (!categoryId) { setMsg('Choose a category'); return }
      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        txn_date: date,
        amount: Number(amount),
        category_id: categoryId,
        note,
        method,
        ym: date.slice(0,7)
      })
      if (error) throw error
      setMsg('Saved ✓'); setAmount(''); setNote('')
    } catch (e:any) { setMsg(e.message) }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Add Expense</h1>

      {needSeed && (
        <div className="p-3 rounded-lg border text-sm">
          No categories yet. <button onClick={seedNow} className="underline">Seed default categories</button>
        </div>
      )}

      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col text-sm">
            <span className="mb-1">Date</span>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded-xl px-3 py-2" required />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1">Amount (₹)</span>
            <input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="border rounded-xl px-3 py-2" required />
          </label>
        </div>

        <label className="flex flex-col text-sm">
          <span className="mb-1">Category</span>
          <select value={categoryId ?? ''} onChange={e=>setCategoryId(Number(e.target.value))} className="border rounded-xl px-3 py-2" required>
            <option value="" disabled>Choose…</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1">Payment Method</span>
          <select value={method} onChange={e=>setMethod(e.target.value as any)} className="border rounded-xl px-3 py-2">
            <option>UPI</option><option>Card</option><option>Cash</option><option>Other</option>
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1">Note (optional)</span>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Dinner at Toit" className="border rounded-xl px-3 py-2" />
        </label>

        <button className="bg-black text-white rounded-xl px-4 py-2">Save Expense</button>
        {msg && <p className="text-sm pt-2">{msg}</p>}
      </form>

      <a href="/" className="text-sm underline">Back to Dashboard</a>
    </div>
  )
}
