'use client'
export default function Home() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard (temp, no login)</h1>
      <p className="text-sm">DEV mode is ON. Data is tied to a fixed local user id.</p>
      <div className="pt-4">
        <a className="underline" href="/add">+ Add Expense</a>
      </div>
    </div>
  )
}
