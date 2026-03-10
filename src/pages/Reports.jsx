import { useState, useEffect } from 'react'
import { Download, FileText, FileDown, File, TrendingUp, TrendingDown, Scale, Wallet } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { CATEGORY_COLORS } from '../hooks/useTransactions'
import { getPayments } from '../db'
import styles from './Reports.module.css'

// ── Export helpers (unchanged) ────────────────────────────────────────
function exportCSV(transactions, schoolName) {
  const header = 'Date,Type,Category,Description,Amount (KSh)\n'
  const rows = transactions.map(t =>
    `${t.date},${t.type},${t.category},"${t.desc}",${t.type === 'expense' ? '-' : ''}${t.amount}`
  ).join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${schoolName || 'school'}-accounts-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

function exportSheets(transactions, schoolName) {
  const header = 'Date\tType\tCategory\tDescription\tAmount (KSh)\n'
  const rows = transactions.map(t =>
    `${t.date}\t${t.type}\t${t.category}\t${t.desc}\t${t.type === 'expense' ? '-' : ''}${t.amount}`
  ).join('\n')
  const blob = new Blob([header + rows], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${schoolName || 'school'}-sheets-${new Date().toISOString().slice(0,10)}.tsv`
  a.click()
}

function exportJSON(transactions, schoolName) {
  const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${schoolName || 'school'}-backup-${new Date().toISOString().slice(0,10)}.json`
  a.click()
}

async function exportPDF(transactions, stats, schoolName, fmt, feesCollected = 0) {
  const { default: jsPDF }      = await import('jspdf')
  const { default: autoTable }  = await import('jspdf-autotable')
  const { income, expense, net } = stats
  const totalIncome = feesCollected + income
  const totalNet    = totalIncome - expense
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const now   = new Date()
  const dateStr = now.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })

  doc.setFillColor(5, 150, 105)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(schoolName || 'School Name', 14, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('FINANCIAL ACCOUNTS REPORT', 14, 20)
  doc.text(`Generated: ${dateStr}`, pageW - 14, 20, { align: 'right' })

  const boxes = [
    { label: 'Fees Collected',  value: fmt(feesCollected), color: [5,150,105] },
    { label: 'Total Income',    value: fmt(totalIncome),   color: [5,150,105] },
    { label: 'Total Expenses',  value: fmt(expense),       color: [220,38,38] },
    { label: 'Net Balance',     value: fmt(Math.abs(totalNet)), color: totalNet >= 0 ? [5,150,105] : [220,38,38] },
  ]
  const boxW = (pageW - 28 - 12) / 4
  boxes.forEach((box, i) => {
    const x = 14 + i * (boxW + 4), y = 34
    doc.setFillColor(245, 247, 250)
    doc.roundedRect(x, y, boxW, 22, 2, 2, 'F')
    doc.setDrawColor(...box.color)
    doc.setLineWidth(0.5)
    doc.line(x, y, x, y + 22)
    doc.setTextColor(100, 110, 130)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(box.label.toUpperCase(), x + 4, y + 7)
    doc.setTextColor(...box.color)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(box.value, x + 4, y + 16)
  })

  const statusY    = 62
  const statusText  = totalNet > 0 ? 'SURPLUS' : totalNet < 0 ? 'DEFICIT' : 'BALANCED'
  const statusColor = totalNet >= 0 ? [5,150,105] : [220,38,38]
  doc.setFillColor(245, 250, 247)
  doc.roundedRect(14, statusY, pageW - 28, 10, 2, 2, 'F')
  doc.setTextColor(...statusColor)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`ACCOUNT STATUS: ${statusText}  |  Total Transactions: ${transactions.length}  |  Report Date: ${dateStr}`, 18, statusY + 6.5)

  const incomeRows  = transactions.filter(t => t.type === 'income')
  const expenseRows = transactions.filter(t => t.type === 'expense')
  let currentY = statusY + 16

  doc.setTextColor(30, 40, 50)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('INCOME', 14, currentY)
  autoTable(doc, {
    startY: currentY + 3,
    head: [['#','Date','Description','Category','Amount (KSh)']],
    body: [
      // Fees collected as first row if any
      ...(feesCollected > 0 ? [[1, now.toISOString().slice(0,10), 'Student Fee Payments', 'Fees Collected', Number(feesCollected).toLocaleString('en-KE',{minimumFractionDigits:2})]] : []),
      // Ledger income rows — start from 2 if fees row exists, else from 1
      ...incomeRows.map((t,i) => [i + (feesCollected > 0 ? 2 : 1), t.date, t.desc, t.category, Number(t.amount).toLocaleString('en-KE',{minimumFractionDigits:2})]),
      // Total row
      ['','','','TOTAL INCOME', Number(totalIncome).toLocaleString('en-KE',{minimumFractionDigits:2})]
    ],
    styles: { fontSize:8, cellPadding:3, font:'helvetica' },
    headStyles: { fillColor:[5,150,105], textColor:255, fontStyle:'bold', fontSize:8 },
    columnStyles: { 0:{cellWidth:8,halign:'center'}, 1:{cellWidth:24}, 2:{cellWidth:70}, 3:{cellWidth:32}, 4:{cellWidth:34,halign:'right'} },
    didParseCell: (d) => {
      const totalRowIndex = (feesCollected > 0 ? 1 : 0) + incomeRows.length
      if (d.row.index === totalRowIndex) {
        d.cell.styles.fillColor=[235,250,243]
        d.cell.styles.textColor=[5,150,105]
        d.cell.styles.fontStyle='bold'
      }
    },
    margin: { left:14, right:14 },
  })
  currentY = doc.lastAutoTable.finalY + 10
  doc.setTextColor(30,40,50)
  doc.setFont('helvetica','bold')
  doc.setFontSize(10)
  doc.text('EXPENSES', 14, currentY)
  autoTable(doc, {
    startY: currentY + 3,
    head: [['#','Date','Description','Category','Amount (KSh)']],
    body: expenseRows.length > 0
      ? [...expenseRows.map((t,i) => [i+1, t.date, t.desc, t.category, Number(t.amount).toLocaleString('en-KE',{minimumFractionDigits:2})]),
         ['','','','TOTAL EXPENSES', Number(expense).toLocaleString('en-KE',{minimumFractionDigits:2})]]
      : [['','','No expenses recorded','','']],
    styles: { fontSize:8, cellPadding:3, font:'helvetica' },
    headStyles: { fillColor:[220,38,38], textColor:255, fontStyle:'bold', fontSize:8 },
    columnStyles: { 0:{cellWidth:8,halign:'center'}, 1:{cellWidth:24}, 2:{cellWidth:70}, 3:{cellWidth:32}, 4:{cellWidth:34,halign:'right'} },
    didParseCell: (d) => { if (d.row.index === expenseRows.length && expenseRows.length > 0) { d.cell.styles.fillColor=[253,242,242]; d.cell.styles.textColor=[220,38,38]; d.cell.styles.fontStyle='bold' } },
    margin: { left:14, right:14 },
  })
  currentY = doc.lastAutoTable.finalY + 10
  autoTable(doc, {
    startY: currentY,
    body: [['NET BALANCE', `${totalNet>=0?'':'-'}${Number(Math.abs(totalNet)).toLocaleString('en-KE',{minimumFractionDigits:2})}`, statusText]],
    styles: { fontSize:10, cellPadding:4, fontStyle:'bold' },
    columnStyles: { 0:{cellWidth:100}, 1:{cellWidth:50,halign:'right',textColor:totalNet>=0?[5,150,105]:[220,38,38]}, 2:{cellWidth:28,halign:'center',textColor:totalNet>=0?[5,150,105]:[220,38,38]} },
    didParseCell: (d) => { d.cell.styles.fillColor = totalNet>=0?[235,250,243]:[253,242,242] },
    margin: { left:14, right:14 },
  })

  const footerY = doc.internal.pageSize.getHeight() - 12
  doc.setFillColor(5,150,105)
  doc.rect(0, footerY-4, pageW, 16, 'F')
  doc.setTextColor(255,255,255)
  doc.setFontSize(8)
  doc.setFont('helvetica','normal')
  doc.text(`${schoolName||'GradeBase'} — Confidential Financial Document`, 14, footerY+4)
  doc.text('Page 1 of 1', pageW-14, footerY+4, { align:'right' })
  doc.save(`${schoolName||'school'}-financial-report-${now.toISOString().slice(0,10)}.pdf`)
}

// ── Stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon: Icon }) {
  return (
    <div className={styles.statCard} style={{ '--accent': accent }}>
      <div className={styles.statTop}>
        <span className={styles.statLabel}>{label}</span>
        <div className={styles.statIcon} style={{ background: accent + '18', color: accent }}>
          <Icon size={14} />
        </div>
      </div>
      <div className={styles.statValue} style={{ color: accent }}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────
export default function Reports({ transactions, stats, spentByCategory, schoolName, fmt }) {
  const { income, expense, net } = stats
  const [feesCollected, setFeesCollected] = useState(0)
  const [feePayments, setFeePayments]     = useState([])
  const [activeTab, setActiveTab]         = useState('overview')

  useEffect(() => {
    getPayments()
      .then(p => {
        setFeePayments(p || [])
        setFeesCollected(p.reduce((s, x) => s + (Number(x.amount)||0), 0))
      })
      .catch(console.warn)
  }, [])

  const totalIncome = feesCollected + income
  const totalNet    = totalIncome - expense
  const netPositive = totalNet >= 0

  const expensePie = Object.entries(spentByCategory)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)

  const incomePie = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => { acc[t.category] = (acc[t.category]||0) + t.amount; return acc }, {})
  // Add fees collected as a category
  if (feesCollected > 0) incomePie['Fees Collected'] = (incomePie['Fees Collected'] || 0) + feesCollected
  const incomePieData = Object.entries(incomePie)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)

  const TABS = ['overview', 'income', 'expenses']

  return (
    <div className={styles.page}>

      {/* ── Top stat cards ── */}
      <div className={styles.statsGrid}>
        <StatCard label="Total Income"    value={fmt(totalIncome)}        sub={`Fees ${fmt(feesCollected)} + Ledger ${fmt(income)}`}  accent="var(--income,#4fffb0)"  icon={TrendingUp}  />
        <StatCard label="Fees Collected"  value={fmt(feesCollected)}       sub="Student fee payments"                                   accent="var(--income,#4fffb0)"  icon={Wallet}      />
        <StatCard label="Total Expenses"  value={fmt(expense)}             sub={`${stats.expenseCount} ledger entries`}                 accent="var(--expense,#ff6b6b)" icon={TrendingDown} />
        <StatCard label="Net Balance"     value={fmt(Math.abs(totalNet))}  sub={netPositive ? '↑ Surplus' : '↓ Deficit'}               accent={netPositive ? 'var(--income,#4fffb0)' : 'var(--expense,#ff6b6b)'} icon={Scale} />
      </div>

      {/* ── Main grid ── */}
      <div className={styles.mainGrid}>

        {/* Left — Summary + Export */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Summary */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Account Summary</span>
            </div>
            <div className={styles.summaryBody}>
              <div className={styles.schoolTitle}>{schoolName || 'School Name'}</div>
              <div className={styles.summaryDate}>
                {new Date().toLocaleDateString('en-KE', { year:'numeric', month:'long', day:'numeric' })}
              </div>
              <div className={styles.divider} />
              <div className={styles.summaryRow}><span>Fees Collected</span><span className={styles.incomeVal}>{fmt(feesCollected)}</span></div>
              <div className={styles.summaryRow}><span>Ledger Income</span><span className={styles.incomeVal}>{fmt(income)}</span></div>
              <div className={styles.summaryRow}><span>Total Income</span><span className={styles.incomeVal} style={{ fontWeight:800 }}>{fmt(totalIncome)}</span></div>
              <div className={styles.summaryRow}><span>Total Expenses</span><span className={styles.expenseVal}>{fmt(expense)}</span></div>
              <div className={styles.divider} />
              <div className={styles.summaryRow}>
                <span className={styles.bold}>Net Balance</span>
                <span className={netPositive ? styles.incomeVal : styles.expenseVal} style={{ fontSize:18, fontWeight:800 }}>
                  {totalNet < 0 ? '-' : ''}{fmt(Math.abs(totalNet))}
                </span>
              </div>
              <div className={styles.balanceChip} style={{
                background: netPositive ? 'rgba(79,255,176,0.1)' : 'rgba(255,107,107,0.1)',
                color:      netPositive ? 'var(--income,#4fffb0)' : 'var(--expense,#ff6b6b)',
                border:     `1px solid ${netPositive ? 'rgba(79,255,176,0.2)' : 'rgba(255,107,107,0.2)'}`
              }}>
                {totalNet > 0 ? '↑ Surplus' : totalNet < 0 ? '↓ Deficit' : 'Balanced'}
              </div>
            </div>
          </div>

          {/* Export */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Export Report</span>
            </div>
            <div className={styles.exportBody}>
              {[
                { label:'Professional PDF', sub:'Boardroom-ready with tables', color:'#dc2626', bg:'rgba(220,38,38,0.1)', icon:FileDown, action:() => exportPDF(transactions, stats, schoolName, fmt, feesCollected) },
                { label:'CSV File',         sub:'Open in Excel, Numbers',       color:'var(--income,#4fffb0)', bg:'rgba(79,255,176,0.1)', icon:FileText, action:() => exportCSV(transactions, schoolName) },
                { label:'Google Sheets',    sub:'Tab-separated, paste directly', color:'#a78bfa', bg:'rgba(167,139,250,0.1)', icon:FileText, action:() => exportSheets(transactions, schoolName) },
                { label:'JSON Backup',      sub:'Full data backup',             color:'#fbbf24', bg:'rgba(251,191,36,0.1)', icon:File, action:() => exportJSON(transactions, schoolName) },
              ].map(({ label, sub, color, bg, icon: Icon, action }) => (
                <button key={label} className={styles.exportBtn} onClick={action}>
                  <div className={styles.exportIcon} style={{ background: bg, color }}>
                    <Icon size={16} />
                  </div>
                  <div className={styles.exportText}>
                    <div className={styles.exportLabel}>{label}</div>
                    <div className={styles.exportSub}>{sub}</div>
                  </div>
                  <Download size={13} style={{ marginLeft:'auto', color:'var(--muted)', flexShrink:0 }} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Charts + Transaction list */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Tabs */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.tabs}>
                {TABS.map(t => (
                  <button key={t} className={styles.tab + (activeTab===t ? ' '+styles.tabActive : '')} onClick={() => setActiveTab(t)}>
                    {t.charAt(0).toUpperCase()+t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'overview' && (
              <div className={styles.chartsRow}>
                <div>
                  <div className={styles.chartLabel}>Expenses by Category</div>
                  {expensePie.length === 0
                    ? <div className={styles.empty}>No expense data yet</div>
                    : <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={expensePie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                            {expensePie.map((e,i) => <Cell key={i} fill={CATEGORY_COLORS[e.name]||'#94a3b8'} />)}
                          </Pie>
                          <Tooltip formatter={v => fmt(v)} contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontSize:12 }} />
                          <Legend wrapperStyle={{ fontSize:11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                  }
                </div>
                <div>
                  <div className={styles.chartLabel}>Income by Category</div>
                  {incomePieData.length === 0
                    ? <div className={styles.empty}>No income data yet</div>
                    : <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={incomePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                            {incomePieData.map((e,i) => <Cell key={i} fill={CATEGORY_COLORS[e.name]||'#94a3b8'} />)}
                          </Pie>
                          <Tooltip formatter={v => fmt(v)} contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontSize:12 }} />
                          <Legend wrapperStyle={{ fontSize:11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                  }
                </div>
              </div>
            )}

            {activeTab === 'income' && (
              <div className={styles.txList}>
                {/* Fees collected — single summary line */}
                {feesCollected > 0 && (
                  <div className={styles.txRow}>
                    <div className={styles.txDot} style={{ background:'rgba(79,255,176,0.12)' }}>
                      <Wallet size={12} color="var(--income,#4fffb0)" />
                    </div>
                    <div className={styles.txInfo}>
                      <div className={styles.txDesc}>Fees Collected</div>
                      <div className={styles.txMeta}>Student fee payments · {feePayments.length} records</div>
                    </div>
                    <span className={styles.incomeVal}>+{fmt(feesCollected)}</span>
                  </div>
                )}
                {/* Ledger income entries */}
                {transactions.filter(t=>t.type==='income').map(t => (
                  <div key={t.id} className={styles.txRow}>
                    <div className={styles.txDot} style={{ background:'rgba(79,255,176,0.12)' }}>
                      <TrendingUp size={12} color="var(--income,#4fffb0)" />
                    </div>
                    <div className={styles.txInfo}>
                      <div className={styles.txDesc}>{t.desc}</div>
                      <div className={styles.txMeta}>{t.category} · {t.date}</div>
                    </div>
                    <span className={styles.incomeVal}>+{fmt(t.amount)}</span>
                  </div>
                ))}
                {feesCollected === 0 && transactions.filter(t=>t.type==='income').length === 0 && (
                  <div className={styles.empty}>No income entries yet</div>
                )}
              </div>
            )}

            {activeTab === 'expenses' && (
              <div className={styles.txList}>
                {transactions.filter(t=>t.type==='expense').length === 0
                  ? <div className={styles.empty}>No expense entries yet</div>
                  : transactions.filter(t=>t.type==='expense').map(t => (
                    <div key={t.id} className={styles.txRow}>
                      <div className={styles.txDot} style={{ background:'rgba(255,107,107,0.12)' }}>
                        <TrendingDown size={12} color="var(--expense,#ff6b6b)" />
                      </div>
                      <div className={styles.txInfo}>
                        <div className={styles.txDesc}>{t.desc}</div>
                        <div className={styles.txMeta}>{t.category} · {t.date}</div>
                      </div>
                      <span className={styles.expenseVal}>-{fmt(t.amount)}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

