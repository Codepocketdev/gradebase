/**
 * Attendance.jsx — thin role router
 * Routes to the correct attendance view based on userRole.
 */
import TeacherAttendance  from './TeacherAttendance'
import StudentAttendance  from './StudentAttendance'
import AdminAttendance    from './AdminAttendance'

export default function Attendance({ user, userRole, dataVersion }) {
  if (userRole === 'teacher') return <TeacherAttendance user={user} dataVersion={dataVersion} />
  if (userRole === 'student') return <StudentAttendance user={user} dataVersion={dataVersion} />
  if (userRole === 'admin')   return <AdminAttendance   dataVersion={dataVersion} />
  return null
}

