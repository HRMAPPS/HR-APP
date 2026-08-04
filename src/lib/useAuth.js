import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

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
      .select('*')
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
