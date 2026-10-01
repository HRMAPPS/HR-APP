import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Hanya kolom non-sensitif. Data pribadi (NIK, rekening, NPWP, BPJS, alamat, dll.)
// tidak boleh dibaca lewat tabel langsung; ambil lewat RPC get_profile_detail().
export const EMPLOYEE_COLUMNS = [
  'id', 'auth_user_id', 'employee_code', 'full_name', 'position', 'department', 'department_id',
  'phone', 'email', 'avatar_url', 'manager_id', 'join_date', 'employment_status', 'role', 'grade',
  'default_shift_id', 'default_work_days', 'created_at',
].join(', ')

// Wraps Supabase Auth session state + the linked `employees` row for the
// logged-in user (employees.auth_user_id references auth.users.id).
export function useAuth() {
  const [session, setSession] = useState(null)
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadEmployee(userId) {
    if (!userId) { setEmployee(null); return }
    const { data, error } = await supabase
      .from('employees')
      .select(EMPLOYEE_COLUMNS)
      .eq('auth_user_id', userId)
      .maybeSingle()
    if (!error) setEmployee(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadEmployee(data.session?.user?.id).finally(() => setLoading(false))
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      loadEmployee(sess?.user?.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return {
    session,
    employee,
    loading,
    isLoggedIn: !!session,
    signOut: () => supabase.auth.signOut(),
    refreshEmployee: () => loadEmployee(session?.user?.id),
  }
}
