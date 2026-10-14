import type { ReactNode } from 'react'
import { CodeXml, Globe, Link2, Mail, MapPin, Moon, Phone, Sun } from 'lucide-react'
import { useCvPreviewTheme } from './cv-preview-theme'
import type { ResumeInput } from '../../services/resume.service'
import './cv-preview.css'
import './cv-reviewer.css'
import {
  hasResumeEntryContent,
  resumeBulletLines,
  resumeMonth,
  sortResumeEntries,
} from './resume-format'
import {
  analyzeCredentialUrl,
  type CredentialVerificationInfo,
} from './credential-verification'

function Text({
  children,
  className,
}: {
  children: string | null | undefined
  className?: string
}) {
  return children?.trim() ? <p className={className}>{children}</p> : null
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cv-paper-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function EmptySection({ detail }: { detail: string }) {
  return <p className="cv-reviewer-empty">{detail}</p>
}

function LabeledText({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <p className="cv-reviewer-field">
      <span>{label}</span>
      {value?.trim() ? value : <em>Chưa cung cấp</em>}
    </p>
  )
}

function LabeledLink({
  label,
  url,
  verification,
}: {
  label: string
  url: string | null | undefined
  verification?: CredentialVerificationInfo | null
}) {
  return (
    <div className="cv-reviewer-field">
      <span>{label}</span>
      {url?.trim() ? (
        <span className="cv-reviewer-link-wrap">
          <WebLink url={url} />
          {verification?.isTrusted && (
            <span
              className="cv-cert-verify-badge is-trusted"
              title={verification.helperText}
            >
              🛡️ {verification.badgeLabel}
            </span>
          )}
          {verification?.isCloudStorage && (
            <span
              className="cv-cert-verify-badge is-warning"
              title={verification.helperText}
            >
              📁 {verification.badgeLabel}
            </span>
          )}
        </span>
      ) : (
        <em>Chưa cung cấp</em>
      )}
    </div>
  )
}

function Bullets({ description }: { description: string }) {
  const lines = resumeBulletLines(description)
  return lines.length ? (
    <ul className="cv-paper-bullets">
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  ) : null
}

function WebLink({ url, label }: { url: string | null | undefined; label?: string }) {
  if (!url?.trim()) return null
  if (!/^https?:\/\//i.test(url)) return <Text>{url}</Text>
  return (
    <a className="cv-paper-link" href={url} target="_blank" rel="noreferrer">
      {label ?? url.replace(/^https?:\/\/(?:www\.)?/i, '').replace(/\/$/, '')}
    </a>
  )
}

const joined = (...values: (string | null | undefined)[]) =>
  values.filter((value) => value?.trim()).join(' · ')
const period = (start: string | undefined, end: string | undefined, current = false) =>
  [resumeMonth(start), current ? 'Hiện tại' : resumeMonth(end)].filter(Boolean).join(' – ')

function Entry({
  title,
  subtitle,
  date,
  children,
}: {
  title: string | null | undefined
  subtitle?: string
  date?: string
  children?: ReactNode
}) {
  return (
    <div className="cv-paper-entry">
      <div className="cv-entry-heading">
        {title?.trim() && <h4>{title}</h4>}
        {date && <span className="cv-entry-date">{date}</span>}
      </div>
      <Text className="cv-entry-subtitle">{subtitle}</Text>
      {children}
    </div>
  )
}

export function CvPreview({
  draft,
  skills,
  presentation = 'reviewer',
}: {
  draft: ResumeInput
  skills: string[]
  presentation?: 'template' | 'reviewer'
}) {
  const [theme, setTheme] = useCvPreviewTheme()
  const reviewer = presentation === 'reviewer'
  const experiences = sortResumeEntries((draft.experiences ?? []).filter(hasResumeEntryContent))
  const educations = sortResumeEntries((draft.educations ?? []).filter(hasResumeEntryContent))
  const projects = sortResumeEntries((draft.projects ?? []).filter(hasResumeEntryContent))
  const certifications = sortResumeEntries(
    (draft.certifications ?? []).filter(hasResumeEntryContent),
  )
  const languages = (draft.languages ?? []).filter(hasResumeEntryContent)
  const awards = sortResumeEntries((draft.awards ?? []).filter(hasResumeEntryContent))
  const activities = sortResumeEntries((draft.activities ?? []).filter(hasResumeEntryContent))
  const displaySkills = skills.filter((skill) => skill.trim())
  const modern = reviewer || draft.template === 'modern'
  const dateLabel = (value: string, label = 'Thời gian') =>
    reviewer ? `${label}: ${value || 'Chưa cung cấp'}` : value
  const hasContact = !!joined(
    draft.email,
    draft.phone,
    draft.location,
    draft.githubUrl,
    draft.linkedinUrl,
    draft.portfolioUrl,
  )

  const contact = reviewer ? (
    <address className="cv-paper-contact cv-reviewer-contact">
      <div>
        <Mail size={15} aria-hidden="true" />
        <div className="cv-reviewer-field">
          <span>Email</span>
          {draft.email?.trim() ? (
            <a href={`mailto:${draft.email.trim()}`}>{draft.email}</a>
          ) : (
            <em>Chưa cung cấp</em>
          )}
        </div>
      </div>
      <div>
        <Phone size={15} aria-hidden="true" />
        <LabeledText label="Số điện thoại" value={draft.phone} />
      </div>
      <div>
        <MapPin size={15} aria-hidden="true" />
        <LabeledText label="Địa điểm" value={draft.location} />
      </div>
      <div>
        <CodeXml size={15} aria-hidden="true" />
        <LabeledLink label="GitHub" url={draft.githubUrl} />
      </div>
      <div>
        <Link2 size={15} aria-hidden="true" />
        <LabeledLink label="LinkedIn" url={draft.linkedinUrl} />
      </div>
      <div>
        <Globe size={15} aria-hidden="true" />
        <LabeledLink label="Portfolio / Website" url={draft.portfolioUrl} />
      </div>
    </address>
  ) : hasContact ? (
    <address className="cv-paper-contact">
      {draft.email?.trim() && <a href={`mailto:${draft.email.trim()}`}>{draft.email}</a>}
      {draft.phone?.trim() && <span>{draft.phone}</span>}
      {draft.location?.trim() && <span>{draft.location}</span>}
      <WebLink url={draft.githubUrl} />
      <WebLink url={draft.linkedinUrl} />
      <WebLink url={draft.portfolioUrl} />
    </address>
  ) : null
  const skillSection =
    reviewer || displaySkills.length ? (
      <Section title="Kỹ năng">
        <ul className="cv-paper-skills">
          {displaySkills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
        {!displaySkills.length && <EmptySection detail="Chưa cung cấp kỹ năng." />}
      </Section>
    ) : null
  const languageSection =
    reviewer || languages.length ? (
      <Section title="Ngoại ngữ">
        {languages.map((item, index) => (
          <Entry
            key={index}
            title={item.name || (reviewer ? 'Ngoại ngữ chưa đặt tên' : '')}
            subtitle={reviewer ? undefined : item.proficiency}
          >
            {reviewer ? (
              <>
                <LabeledText label="Trình độ" value={item.proficiency} />
                <LabeledText label="Chứng nhận" value={item.certification} />
              </>
            ) : (
              <Text>{item.certification}</Text>
            )}
          </Entry>
        ))}
        {!languages.length && (
          <EmptySection detail="Chưa cung cấp ngoại ngữ, trình độ hoặc chứng nhận." />
        )}
      </Section>
    ) : null
  const certificationSection =
    reviewer || certifications.length ? (
      <Section title="Chứng chỉ">
        {certifications.map((item, index) => {
          const verification = analyzeCredentialUrl(item.credentialUrl)
          return (
            <Entry
              key={index}
              title={item.name || (reviewer ? 'Chứng chỉ chưa đặt tên' : '')}
              subtitle={reviewer ? undefined : item.issuer}
              date={dateLabel(resumeMonth(item.issuedDate), 'Ngày cấp')}
            >
              {reviewer ? (
                <>
                  <LabeledText label="Đơn vị cấp" value={item.issuer} />
                  <LabeledLink
                    label="Liên kết chứng chỉ"
                    url={item.credentialUrl}
                    verification={verification}
                  />
                </>
              ) : (
                <div className="cv-cert-paper-link-row">
                  <WebLink url={item.credentialUrl} label="Xem chứng chỉ" />
                  {verification?.isTrusted && (
                    <span className="cv-cert-paper-badge is-trusted">
                      🛡️ {verification.badgeLabel}
                    </span>
                  )}
                  {verification?.isCloudStorage && (
                    <span className="cv-cert-paper-badge is-warning">
                      📁 Bản lưu trữ đám mây
                    </span>
                  )}
                </div>
              )}
            </Entry>
          )
        })}
        {!certifications.length && (
          <EmptySection detail="Chưa cung cấp chứng chỉ, đơn vị cấp, ngày cấp hoặc liên kết xác nhận." />
        )}
      </Section>
    ) : null
  const educationSection =
    reviewer || educations.length ? (
      <Section title="Học vấn">
        {educations.map((item, index) => (
          <Entry
            key={index}
            title={item.school || (reviewer ? 'Trường học chưa cung cấp' : '')}
            subtitle={reviewer ? undefined : joined(item.degree, item.field)}
            date={dateLabel(period(item.startDate, item.endDate))}
          >
            {reviewer && (
              <>
                <LabeledText label="Bằng cấp" value={item.degree} />
                <LabeledText label="Chuyên ngành" value={item.field} />
              </>
            )}
            {item.gpa != null && item.gpaScale != null && (
              <LabeledText label="GPA" value={`${item.gpa} / ${item.gpaScale}`} />
            )}
            <Bullets description={item.description} />
          </Entry>
        ))}
        {!educations.length && (
          <EmptySection detail="Chưa cung cấp trường học, bằng cấp, chuyên ngành hoặc thời gian học." />
        )}
      </Section>
    ) : null
  const projectSection =
    reviewer || projects.length ? (
      <Section title="Dự án">
        {projects.map((item, index) => (
          <Entry
            key={index}
            title={item.name || (reviewer ? 'Dự án chưa đặt tên' : '')}
            subtitle={reviewer ? undefined : item.role}
            date={dateLabel(period(item.startDate, item.endDate, item.current))}
          >
            {reviewer ? (
              <>
                <LabeledText label="Vai trò" value={item.role} />
                <LabeledLink label="Liên kết dự án" url={item.url} />
              </>
            ) : (
              <WebLink url={item.url} />
            )}
            {!!item.technologies?.length && (
              <LabeledText label="Công nghệ sử dụng" value={item.technologies.join(' · ')} />
            )}
            <Bullets description={item.description} />
          </Entry>
        ))}
        {!projects.length && (
          <EmptySection detail="Chưa cung cấp tên dự án, vai trò, liên kết hoặc mô tả đóng góp." />
        )}
      </Section>
    ) : null
  const hasAside =
    reviewer || (modern && !!(contact || skillSection || languageSection || certificationSection))
  const identity = (
    <header className="cv-paper-header">
      {reviewer && (
        <div className="cv-reviewer-monogram" aria-hidden="true">
          {(draft.fullName?.trim() || 'CV')
            .split(/\s+/)
            .slice(-2)
            .map((part) => part[0])
            .join('')}
        </div>
      )}
      {reviewer && <span className="cv-reviewer-eyebrow">Hồ sơ ứng viên</span>}
      <h2>{draft.fullName?.trim() || 'Họ và tên'}</h2>
      {reviewer ? (
        <LabeledText label="Vị trí mong muốn" value={draft.desiredPosition} />
      ) : (
        <Text className="cv-paper-title">{draft.desiredPosition}</Text>
      )}
      {!modern && contact}
    </header>
  )

  return (
    <div
      className={reviewer ? 'cv-document-view' : undefined}
      data-cv-theme={reviewer ? theme : undefined}
    >
      {reviewer && (
        <div className="cv-document-tools">
          <span>Màu nền CV</span>
          <div role="group" aria-label="Màu nền CV">
            <button
              type="button"
              aria-pressed={theme === 'light'}
              onClick={() => setTheme('light')}
            >
              <Sun size={14} aria-hidden="true" />
              Sáng
            </button>
            <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
              <Moon size={14} aria-hidden="true" />
              Tối
            </button>
          </div>
        </div>
      )}
      <article
        className={`cv-preview-paper cv-paper-${reviewer ? 'reviewer' : draft.template}`}
        aria-label="Nội dung CV"
      >
        {!reviewer && identity}
        <div className={`cv-paper-body${hasAside ? ' has-aside' : ''}`}>
          {hasAside && (
            <aside className="cv-paper-aside" aria-label="Liên hệ và năng lực">
              {reviewer && identity}
              {contact && <Section title="Liên hệ">{contact}</Section>}
              {skillSection}
              {languageSection}
              {!reviewer && certificationSection}
            </aside>
          )}
          <div className="cv-paper-main">
            {(reviewer || draft.summary?.trim()) && (
              <Section title="Giới thiệu">
                {draft.summary?.trim() ? (
                  <Text>{draft.summary}</Text>
                ) : (
                  <EmptySection detail="Chưa cung cấp giới thiệu hoặc mục tiêu nghề nghiệp." />
                )}
              </Section>
            )}
            {!experiences.length && educationSection}
            {(reviewer || !!experiences.length) && (
              <Section title="Kinh nghiệm làm việc">
                {experiences.map((item, index) => (
                  <Entry
                    key={index}
                    title={item.position || (reviewer ? 'Vị trí chưa cung cấp' : '')}
                    subtitle={reviewer ? undefined : item.company}
                    date={dateLabel(period(item.startDate, item.endDate, item.current))}
                  >
                    {reviewer && <LabeledText label="Công ty" value={item.company} />}
                    <Bullets description={item.description} />
                  </Entry>
                ))}
                {!experiences.length && (
                  <EmptySection detail="Chưa cung cấp vị trí, công ty, thời gian hoặc mô tả kinh nghiệm." />
                )}
              </Section>
            )}
            {projectSection}
            {!!experiences.length && educationSection}
            {reviewer && certificationSection}
            {!modern && (
              <>
                {skillSection}
                {languageSection}
                {certificationSection}
              </>
            )}
            {(reviewer || !!awards.length) && (
              <Section title="Giải thưởng">
                {awards.map((item, index) => (
                  <Entry
                    key={index}
                    title={item.title || (reviewer ? 'Giải thưởng chưa đặt tên' : '')}
                    subtitle={reviewer ? undefined : item.issuer}
                    date={dateLabel(resumeMonth(item.awardedDate), 'Ngày nhận')}
                  >
                    {reviewer && <LabeledText label="Đơn vị trao" value={item.issuer} />}
                    <Text>{item.description}</Text>
                  </Entry>
                ))}
                {!awards.length && (
                  <EmptySection detail="Chưa cung cấp giải thưởng, đơn vị trao, ngày nhận hoặc mô tả." />
                )}
              </Section>
            )}
            {(draft.extraSections ?? []).map((section, index) => (
              <Section key={`extra-${index}`} title={section.title || 'Mục bổ sung'}>
                <Text>{section.content}</Text>
              </Section>
            ))}
            {(reviewer || !!activities.length) && (
              <Section title="Hoạt động">
                {activities.map((item, index) => (
                  <Entry
                    key={index}
                    title={item.name || (reviewer ? 'Hoạt động chưa đặt tên' : '')}
                    subtitle={reviewer ? undefined : joined(item.role, item.organization)}
                    date={dateLabel(period(item.startDate, item.endDate, item.current))}
                  >
                    {reviewer && (
                      <>
                        <LabeledText label="Tổ chức" value={item.organization} />
                        <LabeledText label="Vai trò" value={item.role} />
                      </>
                    )}
                    <Bullets description={item.description} />
                  </Entry>
                ))}
                {!activities.length && (
                  <EmptySection detail="Chưa cung cấp hoạt động, tổ chức, vai trò, thời gian hoặc mô tả." />
                )}
              </Section>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}
