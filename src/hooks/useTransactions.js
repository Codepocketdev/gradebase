import { useState, useEffect, useMemo } from 'react'

export const DEFAULT_CATEGORIES = [
  'Tuition', 'Fees', 'Grants', 'Donations',
  'Supplies', 'Salaries', 'Utilities', 'Events', 'Maintenance', 'Other'
]

export const BUDGETS = {
  Tuition: 5000000, Fees: 500000, Grants: 2000000, Donations: 1000000,
  Supplies: 300000, Salaries: 8000000, Utilities: 400000,
  Events: 200000, Maintenance: 300000, Other: 250000
}

export const CATEGORY_COLORS = {
  Tuition: '#4fffb0', Fees: '#a78bfa', Grants: '#38bdf8', Donations: '#fb7185',
  Supplies: '#fbbf24', Salaries: '#34d399', Utilities: '#60a5fa', Events: '#f472b6',
  Maintenance: '#f97316', Other: '#94a3b8'
}

export const CATEGORY_ICON_NAMES = {
  Tuition: 'GraduationCap', Fees: 'FileText', Grants: 'Landmark',
  Donations: 'Heart', Supplies: 'Package', Salaries: 'Users',
  Utilities: 'Zap', Events: 'CalendarDays', Maintenance: 'Wrench',
  Other: 'MoreHorizontal'
}

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
  catch { return fallback }
}

export function useTransactions() {
  const [transactions, setTransactions] = useState(() => load('sl_transactions', []))
  const [schoolName, setSchoolNameState] = useState(() => localStorage.getItem('sl_school') || '')
  const [categories, setCategories] = useState(() => load('sl_categories', DEFAULT_CATEGORIES))

  useEffect(() => {
    localStorage.setItem('sl_transactions', JSON.stringify(transactions))
  }, [transactions])

  useEffect(() => {
    localStorage.setItem('sl_categories', JSON.stringify(categories))
  }, [categories])

  const setSchoolName = (name) => {
    setSchoolNameState(name)
    localStorage.setItem('sl_school', name)
  }

  const addTransaction = (tx) => {
    setTransactions(prev => [{ ...tx, id: Date.now() }, ...prev])
  }

  const deleteTransaction = (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const addCategory = (name) => {
    if (!categories.includes(name)) {
      setCategories(prev => [...prev, name])
    }
  }

  const deleteCategory = (name) => {
    setCategories(prev => prev.filter(c => c !== name))
  }

  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const net = income - expense
    const incomeCount = transactions.filter(t => t.type === 'income').length
    const expenseCount = transactions.filter(t => t.type === 'expense').length
    const dates = transactions.map(t => t.date).sort()
    const dateRange = dates.length > 1 ? dates[0] + ' to ' + dates[dates.length - 1] : dates[0] || null
    return { income, expense, net, incomeCount, expenseCount, dateRange }
  }, [transactions])

  const spentByCategory = useMemo(() => {
    const spent = {}
    transactions.filter(t => t.type === 'expense').forEach(t => {
      spent[t.category] = (spent[t.category] || 0) + t.amount
    })
    return spent
  }, [transactions])

  const chartData = useMemo(() => {
    const months = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toISOString().slice(0, 7)
      months[key] = { month: d.toLocaleString('default', { month: 'short' }), income: 0, expense: 0 }
    }
    transactions.forEach(t => {
      const key = t.date.slice(0, 7)
      if (months[key]) months[key][t.type] += t.amount
    })
    return Object.values(months)
  }, [transactions])

  return {
    transactions, schoolName, setSchoolName,
    addTransaction, deleteTransaction,
    categories, addCategory, deleteCategory,
    stats, spentByCategory, chartData
  }
}
