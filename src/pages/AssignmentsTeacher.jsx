import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import Loading from '@/components/ui/Loading'
import AssignmentForm from '@/components/assignments/AssignmentForm'
import AssignmentsList from '@/components/assignments/AssignmentsList'
import SubmissionsList from '@/components/assignments/SubmissionsList'

export default function AssignmentsTeacherPage() {
  const { role } = useAuth()
  const canAccess = ['teacher', 'admin'].includes((role || '').trim().toLowerCase())
  const [selected, setSelected] = useState(null)

  if (!canAccess) return <div className="card p-6 text-center">Доступ запрещён</div>

  return (
    <div className="space-y-6">
      <AssignmentForm onCreated={() => setSelected(null)} />
      <AssignmentsList mode="teacher" onSelectAssignment={setSelected} />
      {selected && <SubmissionsList assignment={selected} />}
    </div>
  )
}