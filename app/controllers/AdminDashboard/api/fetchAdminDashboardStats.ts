'use client'

import { createClient } from '@/lib/supabase/client'
import type { AdminDashboardStats } from '../AdminDashboardTypes'
import type { AdminDashboardStatsRaw } from '../utils/mapAdminDashboardStats'
import { mapAdminDashboardStats } from '../utils/mapAdminDashboardStats'

// Llama al RPC get_admin_dashboard_stats() (jsonb único) y lo mapea. El guard
// is_admin() vive en el RPC; un terapeuta recibe no_autorizado (42501) → throw.
const fetchAdminDashboardStats = async (): Promise<AdminDashboardStats> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_admin_dashboard_stats')
  if (error) throw error
  return mapAdminDashboardStats(data as AdminDashboardStatsRaw)
}

export { fetchAdminDashboardStats }
