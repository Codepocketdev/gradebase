/**
 * Profile.jsx — role router
 * Routes to the correct profile based on user.role
 */
import TeacherProfile from './TeacherProfile'
import StudentProfile from './StudentProfile'
import AdminProfile   from './AdminProfile'

export default function Profile({ user, syncState, onBack, onUpdateUser }) {
  if (user?.role === 'teacher') return <TeacherProfile user={user} syncState={syncState} onBack={onBack} onUpdateUser={onUpdateUser} />
  if (user?.role === 'student') return <StudentProfile user={user} syncState={syncState} />
  if (user?.role === 'admin')   return <AdminProfile   user={user} syncState={syncState} onBack={onBack} onUpdateUser={onUpdateUser} />
  return null
}

