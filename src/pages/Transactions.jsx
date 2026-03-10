import { useState } from 'react'
import { Trash2, TrendingUp, TrendingDown, Pencil, Check, X, RefreshCw } from 'lucide-react'
import CategoryIcon from '../components/CategoryIcon'
import CategoryPicker from '../components/CategoryPicker'
import { CATEGORY_COLORS, CATEGORY_ICON_NAMES } from '../hooks/useTransactions'
import styles from './Transactions.module.css'

const today = () => new Date().toISOString().slice(0, 10)

export default function Transactions({
  transactions, onAdd, onDelete, onEdit,
  fmt, categories, onAddCategory, onDeleteCategory, syncing
}) {
  const [type, setType]         = useState('income')
  const [desc, setDesc]         = useState('')
  const [amount, setAmount]     = useState('')
  const [category, setCategory] = useState(categories[0] || 'Tuition')
  const [date, setDate]         = useState(today())
  const [filter, setFilter]     = useState('all')
  const [errors, setErrors]     = useState({})
  const [editId, setEditId]     = useState(null)
  const [editField, setEditField] = useState({})

  // ── Add ──────────────────────────────────────────────────────────
  const handleAdd = () => {
    const e = {}
    if (!desc.trim())                    e.desc   = true
    if (!amount || parseFloat(amount) <= 0) e.amount = true
    if (!date)                           e.date   = true
    setErrors(e)
    if (Object.keys(e).length > 0) return
    onAdd({ type, desc: desc.trim(), amount: parseFloat(amount), category, date })
    setDesc(''); setAmount(''); setDate(today()); setErrors({})
  }

  // ── Edit ─────────────────────────────────────────────────────────
  const startEdit = (t) => {
    setEditId(t.id)
    setEditField({ desc: t.desc, amount: String(t.amount), category: t.category, date: t.date, type: t.type })
  }

  const saveEdit = () => {
    if (!editField.desc?.trim() || !editField.amount || parseFloat(editField.amount) <= 0) return
    onEdit(editId, {
      desc:     editField.desc.trim(),
      amount:   parseFloat(editField.amount),
      category: editField.category,
      date:     editField.date,
      type:     editField.type,
    })
    setEditId(null)
    setEditField({})
  }

  const cancelEdit = () => { setEditId(null); setEditField({}) }

  const filtered = transactions.filter(t => filter === 'all' || t.type === filter)

  return (
    <div className={styles.page}>

      {syncing && (
        <div className={styles.syncBanner}>
          <RefreshCw size={12} className={styles.spin} />
          Syncing ledger from Nostr…
        </div>
      )}

      <div className={styles.grid}>

        {/* ── Add form ── */}
        <div className={styles.form}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>New Entry</span>
          </div>
          <div className={styles.formBody}>
            <div className={styles.typeToggle}>
              <button
                className={styles.typeBtn + (type==='income' ? ' '+styles.incomeActive : '')}
                onClick={() => setType('income')}>
                <TrendingUp size={14} /> Income
              </button>
              <button
                className={styles.typeBtn + (type==='expense' ? ' '+styles.expenseActive : '')}
                onClick={() => setType('expense')}>
                <TrendingDown size={14} /> Expense
              </button>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <input
                className={styles.input + (errors.desc ? ' '+styles.err : '')}
                placeholder="e.g. Term 1 grants"
                value={desc}
                onChange={e => { setDesc(e.target.value); setErrors(p=>({...p,desc:false})) }}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Amount (KSh)</label>
              <input
                className={styles.input + (errors.amount ? ' '+styles.err : '')}
                type="number" min="0" step="1"
                placeholder="0"
                value={amount}
                onChange={e => { setAmount(e.target.value); setErrors(p=>({...p,amount:false})) }}
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
                className={styles.input + (errors.date ? ' '+styles.err : '')}
                type="date" value={date}
                onChange={e => { setDate(e.target.value); setErrors(p=>({...p,date:false})) }}
              />
            </div>

            <button className={styles.addBtn} onClick={handleAdd}>
              Add Transaction
            </button>
          </div>
        </div>

        {/* ── List ── */}
        <div className={styles.listPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              All Transactions
              <span className={styles.count}>{filtered.length}</span>
            </span>
            <div className={styles.filters}>
              {['all','income','expense'].map(f => (
                <button
                  key={f}
                  className={styles.filterBtn + (filter===f ? ' '+styles.filterActive : '')}
                  onClick={() => setFilter(f)}>
                  {f.charAt(0).toUpperCase()+f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <TrendingUp size={28} strokeWidth={1.5} />
                <div>No transactions yet</div>
                <div className={styles.emptySub}>Add your first entry using the form</div>
              </div>
            ) : (
              filtered.map(t => {
                const color    = CATEGORY_COLORS[t.category] || '#94a3b8'
                const iconName = CATEGORY_ICON_NAMES[t.category] || 'MoreHorizontal'
                const isEditing = editId === t.id

                if (isEditing) return (
                  <div key={t.id} className={styles.editRow}>
                    <div className={styles.editFields}>
                      <div className={styles.editTypeToggle}>
                        <button
                          className={styles.editTypeBtn + (editField.type==='income' ? ' '+styles.incomeActive : '')}
                          onClick={() => setEditField(p=>({...p,type:'income'}))}>
                          <TrendingUp size={12} /> Income
                        </button>
                        <button
                          className={styles.editTypeBtn + (editField.type==='expense' ? ' '+styles.expenseActive : '')}
                          onClick={() => setEditField(p=>({...p,type:'expense'}))}>
                          <TrendingDown size={12} /> Expense
                        </button>
                      </div>
                      <input
                        className={styles.editInput}
                        value={editField.desc}
                        onChange={e => setEditField(p=>({...p,desc:e.target.value}))}
                        placeholder="Description"
                      />
                      <div className={styles.editRow2}>
                        <input
                          className={styles.editInput}
                          type="number" min="0"
                          value={editField.amount}
                          onChange={e => setEditField(p=>({...p,amount:e.target.value}))}
                          placeholder="Amount"
                        />
                        <input
                          className={styles.editInput}
                          type="date"
                          value={editField.date}
                          onChange={e => setEditField(p=>({...p,date:e.target.value}))}
                        />
                      </div>
                    </div>
                    <div className={styles.editActions}>
                      <button className={styles.saveBtn} onClick={saveEdit}><Check size={14} /> Save</button>
                      <button className={styles.cancelBtn} onClick={cancelEdit}><X size={14} /></button>
                    </div>
                  </div>
                )

                return (
                  <div key={t.id} className={styles.item}>
                    <div className={styles.iconWrap} style={{ background: color+'22', color }}>
                      <CategoryIcon name={iconName} size={15} />
                    </div>
                    <div className={styles.info}>
                      <div className={styles.desc}>{t.desc}</div>
                      <div className={styles.meta}>{t.category} · {t.date}</div>
                    </div>
                    <div className={t.type==='income' ? styles.incomeAmt : styles.expenseAmt}>
                      {t.type==='income' ? '+' : '-'}{fmt(t.amount)}
                    </div>
                    <div className={styles.itemActions}>
                      <button className={styles.editBtn} onClick={() => startEdit(t)}>
                        <Pencil size={13} />
                      </button>
                      <button className={styles.deleteBtn} onClick={() => onDelete(t.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
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

