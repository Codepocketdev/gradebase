import AdminPayments   from './AdminPayments'
import TeacherPayments from './TeacherPayments'
import StudentPayments from './StudentPayments'

export default function Payments({ user, userRole, dataVersion }) {
  if (userRole === 'admin')   return <AdminPayments   user={user} dataVersion={dataVersion} />
  if (userRole === 'teacher') return <TeacherPayments user={user} dataVersion={dataVersion} />
  if (userRole === 'student') return <StudentPayments user={user} dataVersion={dataVersion} />
  return null
}

