import type { AdminActivity } from './admin-data'

/** UTF-8 CSV with quoted fields and spreadsheet formula escaping. */
export function createActivityCsv(activities: AdminActivity[], actor: string) {
  const cell = (value: string) => {
    const safe = /^(?:\s*[=+\-@]|[\t\r\n])/.test(value) ? `'${value}` : value
    return `"${safe.replace(/"/g, '""')}"`
  }
  const rows = [
    ['Thời gian', 'Người thao tác', 'Hành động', 'Đối tượng'],
    ...activities.map((activity) => [
      new Date(activity.at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      actor,
      activity.action,
      activity.target,
    ]),
  ]
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n')
}
