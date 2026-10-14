export { RecruiterRealApplications as RecruiterApplications } from '../../applications/components/RecruiterRealApplications'
import { dateLabel } from '../recruiter-model'
export function Timeline({
  items,
}: {
  items: { id: string; at: string; actor: string; text: string }[]
}) {
  return (
    <ol className="hr-timeline">
      {items.map((item) => (
        <li key={item.id}>
          <small>
            {dateLabel(item.at, true)} · {item.actor}
          </small>
          <p>{item.text}</p>
        </li>
      ))}
    </ol>
  )
}
