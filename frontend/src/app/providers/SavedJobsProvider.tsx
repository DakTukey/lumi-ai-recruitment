import { useState, type ReactNode } from 'react'
import { useAuth } from './auth-context'
import { SavedJobsContext } from './saved-jobs-context'
export function SavedJobsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return <AccountSavedJobs key={user?.id ?? 'guest'}>{children}</AccountSavedJobs>
}
function AccountSavedJobs({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<(string | number)[]>([])
  return (
    <SavedJobsContext.Provider
      value={{
        saved,
        toggleSaved: (id) =>
          setSaved((previous) =>
            previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
          ),
      }}
    >
      {children}
    </SavedJobsContext.Provider>
  )
}
