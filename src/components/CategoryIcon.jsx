import {
  GraduationCap, FileText, Landmark, Heart, Package,
  Users, Zap, CalendarDays, Wrench, MoreHorizontal
} from 'lucide-react'

const ICONS = {
  GraduationCap, FileText, Landmark, Heart, Package,
  Users, Zap, CalendarDays, Wrench, MoreHorizontal
}

export default function CategoryIcon({ name, size = 16, ...props }) {
  const Icon = ICONS[name] || MoreHorizontal
  return <Icon size={size} {...props} />
}
