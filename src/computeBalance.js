/**
 * computeStudentBalance — lunch-aware balance calculator
 *
 * Lunch category is identified by cat.isLunch === true.
 * Home lunch students owe KSh 0.
 * All other lunch types (monthly/weekly/daily) owe the flat cat.amount set in FeeStructure.
 * Payments accumulate freely against that target — no installment rules enforced.
 */
export function computeStudentBalance(studentNpub, studentLunchType, payments, feeStructure, classId) {
  if (!feeStructure) return { categories: [], total: 0, paid: 0, balance: 0, fullyPaid: false }
  const tier = feeStructure.tiers?.find(t => t.classIds?.includes(classId))
  if (!tier) return { categories: [], total: 0, paid: 0, balance: 0, fullyPaid: false }

  const lunchType   = studentLunchType || 'monthly'
  const studentPmts = payments.filter(p => p.studentNpub === studentNpub)

  let total = 0, paid = 0
  const categories = tier.categories.map(cat => {
    // Home lunch students pay nothing for lunch
    const targetAmount = (cat.isLunch && lunchType === 'home') ? 0 : (Number(cat.amount) || 0)

    const catPaid = studentPmts
      .filter(p => p.categoryId === cat.id)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0)

    total += targetAmount
    paid  += catPaid

    return {
      ...cat,
      amount:  targetAmount,
      paid:    catPaid,
      balance: Math.max(0, targetAmount - catPaid),
      done:    targetAmount > 0 && catPaid >= targetAmount,
    }
  })

  return {
    categories,
    total,
    paid,
    balance:   Math.max(0, total - paid),
    fullyPaid: total > 0 && paid >= total,
    lunchType,
  }
}

