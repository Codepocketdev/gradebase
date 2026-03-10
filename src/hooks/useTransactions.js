import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  getLedgerTransactions, saveLedgerTransaction, deleteLedgerTransaction,
  replaceAllLedgerTransactions, getBudgetsMap, saveBudget, getSchool,
} from '../db'
import {
  publishLedgerEntry, publishLedgerDelete, fetchAndSeedLedger,
  publishBudgets, fetchAndSeedBudgets,
  publishCategories, fetchAndSeedCategories,
} from '../nostrSync'

export const DEFAULT_CATEGORIES = [
  'Tuition','Fees','Grants','Donations',
  'Supplies','Salaries','Utilities','Events','Maintenance','Other'
]

export const BUDGETS = {
  Tuition:5000000, Fees:500000, Grants:2000000, Donations:1000000,
  Supplies:300000, Salaries:8000000, Utilities:400000,
  Events:200000, Maintenance:300000, Other:250000
}

export const CATEGORY_COLORS = {
  Tuition:'#4fffb0', Fees:'#a78bfa', Grants:'#38bdf8', Donations:'#fb7185',
  Supplies:'#fbbf24', Salaries:'#34d399', Utilities:'#60a5fa', Events:'#f472b6',
  Maintenance:'#f97316', Other:'#94a3b8', 'Fees Collected':'#4fffb0'
}

export const CATEGORY_ICON_NAMES = {
  Tuition:'GraduationCap', Fees:'FileText', Grants:'Landmark', Donations:'Heart',
  Supplies:'Package', Salaries:'Users', Utilities:'Zap', Events:'CalendarDays',
  Maintenance:'Wrench', Other:'MoreHorizontal'
}

export function useTransactions(user) {
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets]           = useState(BUDGETS)
  const [categories, setCategories]     = useState(DEFAULT_CATEGORIES)
  const [schoolName, setSchoolName]     = useState('')
  const [syncing, setSyncing]           = useState(false)

  const nsec = user?.nsec || null
  const npub = user?.npub || null

  const nsecRef = useRef(null)
  useEffect(() => { nsecRef.current = nsec }, [nsec])

  // ── Load IndexedDB on mount ───────────────────────────────────────
  useEffect(() => {
    getLedgerTransactions()
      .then(txns => setTransactions(txns || []))
      .catch(console.warn)

    getBudgetsMap()
      .then(map => { if (Object.keys(map).length > 0) setBudgets(prev => ({ ...prev, ...map })) })
      .catch(console.warn)

    // Load school name from IndexedDB
    getSchool()
      .then(school => { if (school?.schoolName) setSchoolName(school.schoolName) })
      .catch(console.warn)
  }, [])

  // ── Fetch from Nostr on login ─────────────────────────────────────
  useEffect(() => {
    if (!nsec || !npub) return
    setSyncing(true)
    Promise.all([
      fetchAndSeedLedger(npub),
      fetchAndSeedBudgets(npub),
      fetchAndSeedCategories(npub),
    ])
      .then(([txns, budgetMap, cats]) => {
        if (txns && txns.length > 0)  setTransactions(txns)
        if (budgetMap)                setBudgets(prev => ({ ...prev, ...budgetMap }))
        if (cats && cats.length > 0)  setCategories(cats)
      })
      .catch(console.warn)
      .finally(() => setSyncing(false))
  }, [nsec, npub])

  // ── Add transaction ───────────────────────────────────────────────
  const addTransaction = useCallback(async (txData) => {
    const newTx = { ...txData, id: Date.now(), createdAt: Date.now() }
    await saveLedgerTransaction(newTx)
    setTransactions(prev => [newTx, ...prev])
    const key = nsecRef.current
    if (key) publishLedgerEntry(key, newTx).catch(console.warn)
  }, [])

  // ── Delete transaction ────────────────────────────────────────────
  const deleteTransaction = useCallback(async (id) => {
    await deleteLedgerTransaction(id)
    setTransactions(prev => prev.filter(t => t.id !== id))
    const key = nsecRef.current
    if (key) publishLedgerDelete(key, id).catch(console.warn)
  }, [])

  // ── Edit transaction ──────────────────────────────────────────────
  const editTransaction = useCallback(async (id, changes) => {
    let updated
    setTransactions(prev => {
      updated = prev.map(t => t.id === id ? { ...t, ...changes, updatedAt: Date.now() } : t)
      return updated
    })
    setTimeout(async () => {
      const txn = updated?.find(t => t.id === id)
      if (!txn) return
      await saveLedgerTransaction(txn).catch(console.warn)
      const key = nsecRef.current
      if (key) publishLedgerEntry(key, txn).catch(console.warn)
    }, 0)
  }, [])

  // ── Categories ────────────────────────────────────────────────────
  const addCategory = useCallback((name) => {
    setCategories(prev => {
      if (prev.includes(name)) return prev
      const updated = [...prev, name]
      const key = nsecRef.current
      if (key) publishCategories(key, updated).catch(console.warn)
      return updated
    })
  }, [])

  const deleteCategory = useCallback((name) => {
    setCategories(prev => {
      const updated = prev.filter(c => c !== name)
      const key = nsecRef.current
      if (key) publishCategories(key, updated).catch(console.warn)
      return updated
    })
  }, [])

  // ── Budgets ───────────────────────────────────────────────────────
  const updateBudget = useCallback(async (category, amount) => {
    await saveBudget(category, amount)
    setBudgets(prev => {
      const updated = { ...prev, [category]: amount }
      const key = nsecRef.current
      if (key) publishBudgets(key, updated).catch(console.warn)
      return updated
    })
  }, [])

  // ── Derived stats ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const income  = transactions.filter(t => t.type==='income').reduce((s,t) => s+t.amount, 0)
    const expense = transactions.filter(t => t.type==='expense').reduce((s,t) => s+t.amount, 0)
    const dates   = transactions.map(t => t.date).sort()
    return {
      income, expense, net: income - expense,
      incomeCount:  transactions.filter(t => t.type==='income').length,
      expenseCount: transactions.filter(t => t.type==='expense').length,
      dateRange: dates.length > 1 ? dates[0]+' to '+dates[dates.length-1] : dates[0] || null
    }
  }, [transactions])

  const spentByCategory = useMemo(() => {
    const spent = {}
    transactions.filter(t => t.type==='expense').forEach(t => {
      spent[t.category] = (spent[t.category]||0) + t.amount
    })
    return spent
  }, [transactions])

  const chartData = useMemo(() => {
    const months = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      months[key] = { month: d.toLocaleString('default', { month:'short' }), income:0, expense:0 }
    }
    transactions.forEach(t => {
      const key = t.date?.slice(0, 7)
      if (key && months[key]) months[key][t.type] += t.amount
    })
    return Object.values(months)
  }, [transactions])

  return {
    transactions, schoolName,
    addTransaction, deleteTransaction, editTransaction,
    categories, addCategory, deleteCategory,
    budgets, updateBudget,
    stats, spentByCategory, chartData,
    syncing,
  }
}

