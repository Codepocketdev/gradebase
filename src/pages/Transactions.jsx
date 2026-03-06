import { useState } from 'react'
import { Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import CategoryIcon from '../components/CategoryIcon'
import CategoryPicker from '../components/CategoryPicker'
import { CATEGORY_COLORS, CATEGORY_ICON_NAMES } from '../hooks/useTransactions'
import styles from './Transactions.module.css'

const today = () => new Date().toISOString().slice(0, 10)

export default function Transactions({ transactions, onAdd, onDelete, fmt, categories, onAddCategory, onDeleteCategory }) {
  const [type, setType] = useState('income')
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(categories[0] || 'Tuition')
  const [date, setDate] = useState(today())
  const [filter, setFilter] = useState('all')
  const [errors, setErrors] = useState({})

  const handleAdd = () => {
    const e = {}
    if (!desc.trim()) e.desc = true
    if (!amount || parseFloat(amount) <= 0) e.amount = true
    if (!date) e.date = true
    setErrors(e)
    if (Object.keys(e).length > 0) return
    onAdd({ type, desc: desc.trim(), amount: parseFloat(amount), category, date })
    setDesc(''); setAmount(''); setDate(today()); setErrors({})
  }

  const filtered = transactions.filter(t => filter === 'all' || t.type === filter)

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        <div className={styles.form}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>New Transaction</span>
          </div>
          <div className={styles.formBody}>
            <div className={styles.typeToggle}>
              <button className={styles.typeBtn + (type === 'income' ? ' ' + styles.incomeActive : '')} onClick={() => setType('income')}>
                <TrendingUp size={14} /> Income
              </button>
              <button className={styles.typeBtn + (type === 'expense' ? ' ' + styles.expenseActive : '')} onClick={() => setType('expense')}>
                <TrendingDown size={14} /> Expense
              </button>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <input
                className={styles.input + (errors.desc ? ' ' + styles.err : '')}
                value={desc}
                onChange={e => { setDesc(e.target.value); setErrors(p => ({ ...p, desc: false })) }}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Amount (KSh)</label>
              <input
                className={styles.input + (errors.amount ? ' ' + styles.err : '')}
                type="number" min="0" step="1"
                value={amount}
                onChange={e => { setAmount(e.target.value); setErrors(p => ({ ...p, amount: false })) }}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Category</label>
              <CategoryPicker
                value={category}
                onChange={setCategory}
                categories={categories}
                onAddCategory={onAddCategory}
                onDeleteCategory={onDeleteCategory}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Date</label>
              <input
                className={styles.input + (errors.date ? ' ' + styles.err : '')}
                type="date" value={date}
                onChange={e => { setDate(e.target.value); setErrors(p => ({ ...p, date: false })) }}
              />
            </div>

            <button className={styles.addBtn} onClick={handleAdd}>Add Transaction</button>
          </div>
        </div>

        <div className={styles.listPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>All Transactions</span>
            <div className={styles.filters}>
              {['all', 'income', 'expense'].map(f => (
                <button
                  key={f}
                  className={styles.filterBtn + (filter === f ? ' ' + styles.filterActive : '')}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>No transactions found</div>
            ) : (
              filtered.map(t => {
                const color = CATEGORY_COLORS[t.category] || '#94a3b8'
                const iconName = CATEGORY_ICON_NAMES[t.category] || 'MoreHorizontal'
                return (
                  <div key={t.id} className={styles.item}>
                    <div className={styles.iconWrap} style={{ background: color + '22', color }}>
                      <CategoryIcon name={iconName} size={15} />
                    </div>
                    <div className={styles.info}>
                      <div className={styles.desc}>{t.desc}</div>
                      <div className={styles.meta}>{t.category} · {t.date}</div>
                    </div>
                    <div className={t.type === 'income' ? styles.incomeAmt : styles.expenseAmt}>
                      {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                    </div>
                    <button className={styles.deleteBtn} onClick={() => onDelete(t.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
