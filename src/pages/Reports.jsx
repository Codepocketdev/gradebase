import { CATEGORY_COLORS } from '../hooks/useTransactions'
import { Download, FileText, Sheet, File, FileDown } from 'lucide-react'
import styles from './Reports.module.css'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

function exportCSV(transactions, schoolName) {
  const header = 'Date,Type,Category,Description,Amount (KSh)\n'
  const rows = transactions.map(t =>
    `${t.date},${t.type},${t.category},"${t.desc}",${t.type === 'expense' ? '-' : ''}${t.amount}`
  ).join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${schoolName || 'school'}-accounts-${new Date().toISOString().slice(0, 10)}.csv`
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
  a.download = `${schoolName || 'school'}-sheets-${new Date().toISOString().slice(0, 10)}.tsv`
  a.click()
}

function exportJSON(transactions, schoolName) {
  const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${schoolName || 'school'}-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
}

async function exportPDF(transactions, stats, schoolName, fmt) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })

  // ── HEADER BAR ──
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

  // ── SUMMARY BOXES ──
  const { income, expense, net } = stats
  const boxes = [
    { label: 'Total Income', value: fmt(income), color: [5, 150, 105] },
    { label: 'Total Expenses', value: fmt(expense), color: [220, 38, 38] },
    { label: 'Net Balance', value: fmt(Math.abs(net)), color: net >= 0 ? [5, 150, 105] : [220, 38, 38] },
  ]

  const boxW = (pageW - 28 - 10) / 3
  boxes.forEach((box, i) => {
    const x = 14 + i * (boxW + 5)
    const y = 34
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

  // ── BALANCE STATUS ──
  const statusY = 62
  const statusText = net > 0 ? 'SURPLUS' : net < 0 ? 'DEFICIT' : 'BALANCED'
  const statusColor = net >= 0 ? [5, 150, 105] : [220, 38, 38]
  doc.setFillColor(...statusColor, 0.1)
  doc.setFillColor(245, 250, 247)
  doc.roundedRect(14, statusY, pageW - 28, 10, 2, 2, 'F')
  doc.setTextColor(...statusColor)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`ACCOUNT STATUS: ${statusText}  |  Total Transactions: ${transactions.length}  |  Report Date: ${dateStr}`, 14 + 4, statusY + 6.5)

  // ── INCOME TABLE ──
  const incomeRows = transactions.filter(t => t.type === 'income')
  const expenseRows = transactions.filter(t => t.type === 'expense')

  let currentY = statusY + 16

  doc.setTextColor(30, 40, 50)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('INCOME', 14, currentY)

  autoTable(doc, {
    startY: currentY + 3,
    head: [['#', 'Date', 'Description', 'Category', 'Amount (KSh)']],
    body: incomeRows.length > 0
      ? [
          ...incomeRows.map((t, i) => [
            i + 1,
            t.date,
            t.desc,
            t.category,
            Number(t.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })
          ]),
          ['', '', '', 'TOTAL INCOME',
            Number(income).toLocaleString('en-KE', { minimumFractionDigits: 2 })
          ]
        ]
      : [['', '', 'No income recorded', '', '']],
    styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 24 },
      2: { cellWidth: 70 },
      3: { cellWidth: 32 },
      4: { cellWidth: 34, halign: 'right' },
    },
    footStyles: { fillColor: [235, 250, 243], textColor: [5, 150, 105], fontStyle: 'bold' },
    didParseCell: (data) => {
      if (data.row.index === incomeRows.length && incomeRows.length > 0) {
        data.cell.styles.fillColor = [235, 250, 243]
        data.cell.styles.textColor = [5, 150, 105]
        data.cell.styles.fontStyle = 'bold'
      }
    },
    margin: { left: 14, right: 14 },
  })

  currentY = doc.lastAutoTable.finalY + 10

  // ── EXPENSE TABLE ──
  doc.setTextColor(30, 40, 50)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('EXPENSES', 14, currentY)

  autoTable(doc, {
    startY: currentY + 3,
    head: [['#', 'Date', 'Description', 'Category', 'Amount (KSh)']],
    body: expenseRows.length > 0
      ? [
          ...expenseRows.map((t, i) => [
            i + 1,
            t.date,
            t.desc,
            t.category,
            Number(t.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })
          ]),
          ['', '', '', 'TOTAL EXPENSES',
            Number(expense).toLocaleString('en-KE', { minimumFractionDigits: 2 })
          ]
        ]
      : [['', '', 'No expenses recorded', '', '']],
    styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 24 },
      2: { cellWidth: 70 },
      3: { cellWidth: 32 },
      4: { cellWidth: 34, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.row.index === expenseRows.length && expenseRows.length > 0) {
        data.cell.styles.fillColor = [253, 242, 242]
        data.cell.styles.textColor = [220, 38, 38]
        data.cell.styles.fontStyle = 'bold'
      }
    },
    margin: { left: 14, right: 14 },
  })

  currentY = doc.lastAutoTable.finalY + 10

  // ── NET BALANCE ROW ──
  autoTable(doc, {
    startY: currentY,
    body: [[
      'NET BALANCE',
      `${net >= 0 ? '' : '-'}${Number(Math.abs(net)).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`,
      statusText
    ]],
    styles: { fontSize: 10, cellPadding: 4, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 50, halign: 'right', textColor: net >= 0 ? [5, 150, 105] : [220, 38, 38] },
      2: { cellWidth: 28, halign: 'center', textColor: net >= 0 ? [5, 150, 105] : [220, 38, 38] },
    },
    didParseCell: (data) => {
      data.cell.styles.fillColor = net >= 0 ? [235, 250, 243] : [253, 242, 242]
    },
    margin: { left: 14, right: 14 },
  })

  // ── FOOTER ──
  const footerY = doc.internal.pageSize.getHeight() - 12
  doc.setFillColor(5, 150, 105)
  doc.rect(0, footerY - 4, pageW, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`${schoolName || 'GradeBase'} — Confidential Financial Document`, 14, footerY + 4)
  doc.text(`Page 1 of 1`, pageW - 14, footerY + 4, { align: 'right' })

  doc.save(`${schoolName || 'school'}-financial-report-${now.toISOString().slice(0, 10)}.pdf`)
}

export default function Reports({ transactions, stats, spentByCategory, schoolName, fmt }) {
  const { income, expense, net } = stats

  const pieData = Object.entries(spentByCategory)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)

  const incomePie = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc }, {})

  const incomePieData = Object.entries(incomePie)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <div className={styles.summaryPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Account Summary</span>
          </div>
          <div className={styles.summaryBody}>
            <div className={styles.schoolTitle}>{schoolName || 'School Name'}</div>
            <div className={styles.summaryDate}>
              Generated: {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className={styles.divider} />
            <div className={styles.summaryRow}><span>Total Income</span><span className={styles.incomeVal}>{fmt(income)}</span></div>
            <div className={styles.summaryRow}><span>Total Expenses</span><span className={styles.expenseVal}>{fmt(expense)}</span></div>
            <div className={styles.divider} />
            <div className={styles.summaryRow}>
              <span className={styles.bold}>Net Balance</span>
              <span className={net >= 0 ? styles.incomeVal : styles.expenseVal} style={{ fontSize: 18, fontWeight: 800 }}>
                {net < 0 ? '-' : ''}{fmt(Math.abs(net))}
              </span>
            </div>
            <div className={styles.balanceChip} style={{
              background: net >= 0 ? 'rgba(79,255,176,0.1)' : 'rgba(255,107,107,0.1)',
              color: net >= 0 ? 'var(--income)' : 'var(--expense)',
              border: `1px solid ${net >= 0 ? 'rgba(79,255,176,0.2)' : 'rgba(255,107,107,0.2)'}`
            }}>
              {net > 0 ? 'Surplus' : net < 0 ? 'Deficit' : 'Balanced'}
            </div>
          </div>
        </div>

        <div className={styles.exportPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Export</span>
          </div>
          <div className={styles.exportBody}>
            <button className={styles.exportBtn} onClick={() => exportPDF(transactions, stats, schoolName, fmt)}>
              <div className={styles.exportIcon} style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
                <FileDown size={18} />
              </div>
              <div>
                <div className={styles.exportLabel}>Professional PDF</div>
                <div className={styles.exportSub}>Boardroom-ready with tables</div>
              </div>
              <Download size={14} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
            </button>

            <button className={styles.exportBtn} onClick={() => exportCSV(transactions, schoolName)}>
              <div className={styles.exportIcon} style={{ background: 'rgba(79,255,176,0.1)', color: 'var(--income)' }}>
                <FileText size={18} />
              </div>
              <div>
                <div className={styles.exportLabel}>CSV File</div>
                <div className={styles.exportSub}>Open in Excel, Numbers</div>
              </div>
              <Download size={14} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
            </button>

            <button className={styles.exportBtn} onClick={() => exportSheets(transactions, schoolName)}>
              <div className={styles.exportIcon} style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8' }}>
                <Sheet size={18} />
              </div>
              <div>
                <div className={styles.exportLabel}>Google Sheets</div>
                <div className={styles.exportSub}>Tab-separated, paste directly</div>
              </div>
              <Download size={14} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
            </button>

            <button className={styles.exportBtn} onClick={() => exportJSON(transactions, schoolName)}>
              <div className={styles.exportIcon} style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
                <File size={18} />
              </div>
              <div>
                <div className={styles.exportLabel}>JSON Backup</div>
                <div className={styles.exportSub}>Full data backup</div>
              </div>
              <Download size={14} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.chartPanel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Expenses by Category</span></div>
          {pieData.length === 0 ? (
            <div className={styles.empty}>No expense data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={styles.chartPanel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Income by Category</span></div>
          {incomePieData.length === 0 ? (
            <div className={styles.empty}>No income data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={incomePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                  {incomePieData.map((entry, i) => <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
