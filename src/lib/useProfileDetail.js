import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Backs all the "Info saya" detail pages in Akun (Info personal, pekerjaan,
// kontak darurat, keluarga, pendidikan & pengalaman, payroll, tambahan).
// One shared loader + set of mutation helpers, each wired to its own RPC.
export function useProfileDetail() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data: result, error } = await supabase.rpc('get_profile_detail')
    if (!error) setData(result)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function run(rpcName, params) {
    setSaving(true)
    const { error } = await supabase.rpc(rpcName, params)
    setSaving(false)
    if (error) return { ok: false, message: error.message }
    await load()
    return { ok: true }
  }

  return {
    data, loading, saving, reload: load,
    updatePersonal: (p) => run('update_personal_info', p),
    updateEmergency: (p) => run('update_emergency_contact', p),
    updatePayroll: (p) => run('update_payroll_info', p),
    updateAdditional: (p) => run('update_additional_info', p),
    upsertFamily: (p) => run('upsert_family_member', p),
    deleteFamily: (id) => run('delete_family_member', { p_id: id }),
    upsertEducation: (p) => run('upsert_education', p),
    deleteEducation: (id) => run('delete_education', { p_id: id }),
  }
}
