import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { uploadEmployeeFile, removeEmployeeFile } from './employeeFiles'

import { tx } from './i18n'
// Backs all the "Info saya" detail pages in Akun (Info personal, pekerjaan,
// kontak darurat, keluarga, pendidikan & pengalaman, payroll, tambahan,
// file saya, peringatan). One shared loader + set of mutation helpers.
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

  async function uploadFile(file) {
    setSaving(true)
    try {
      await uploadEmployeeFile(file, data?.employee?.id)
      await load()
      return { ok: true }
    } catch (e) {
      return { ok: false, message: e.message || tx("Gagal mengunggah file") }
    } finally {
      setSaving(false)
    }
  }

  async function deleteFile(id, fileUrl) {
    setSaving(true)
    try {
      await removeEmployeeFile(id, fileUrl)
      await load()
      return { ok: true }
    } catch (e) {
      return { ok: false, message: e.message }
    } finally {
      setSaving(false)
    }
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
    uploadFile, deleteFile,
  }
}
