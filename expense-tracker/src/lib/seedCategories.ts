import { supabase } from '@/lib/supabaseClient'

const DEFAULTS = [
  'Food & Dining','Groceries','Shopping','Transport','Bills & Utilities',
  'Subscriptions','Health','Entertainment/Outing','Drinking','Investments',
  'Given to Mom','Misc'
]

export async function ensureDefaultCategories() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data, error } = await supabase.from('categories').select('id').limit(1)
  if (error) throw error
  if (data && data.length > 0) return
  const rows = DEFAULTS.map(name => ({ user_id: user.id, name, kind: 'expense', is_default: true }))
  await supabase.from('categories').insert(rows)
}
