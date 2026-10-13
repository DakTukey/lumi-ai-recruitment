export interface CredentialPlatformPreset {
  id: string
  name: string
  prefix: string
  placeholder: string
  iconType: 'shield' | 'code' | 'cloud' | 'drive' | 'school'
  description: string
}

export const CREDENTIAL_PRESETS: CredentialPlatformPreset[] = [
  {
    id: 'credly',
    name: 'Credly',
    prefix: 'https://www.credly.com/badges/',
    placeholder: 'https://www.credly.com/badges/...',
    iconType: 'shield',
    description: 'AWS, Cisco, Oracle, Microsoft, IBM...',
  },
  {
    id: 'coursera',
    name: 'Coursera',
    prefix: 'https://www.coursera.org/verify/',
    placeholder: 'https://www.coursera.org/verify/...',
    iconType: 'school',
    description: 'Google, DeepLearning.AI, IBM, Meta...',
  },
  {
    id: 'hackerrank',
    name: 'HackerRank',
    prefix: 'https://www.hackerrank.com/certificates/',
    placeholder: 'https://www.hackerrank.com/certificates/...',
    iconType: 'code',
    description: 'Java, Python, Problem Solving, React...',
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    prefix: 'https://learn.microsoft.com/credentials/',
    placeholder: 'https://learn.microsoft.com/credentials/...',
    iconType: 'shield',
    description: 'Azure Fundamentals, Solutions Architect...',
  },
  {
    id: 'google',
    name: 'Google / Accredible',
    prefix: 'https://google.accredible.com/',
    placeholder: 'https://google.accredible.com/... hoặc credential.net',
    iconType: 'cloud',
    description: 'Google Cloud Certified, TensorFlow...',
  },
  {
    id: 'udemy',
    name: 'Udemy',
    prefix: 'https://www.udemy.com/certificate/',
    placeholder: 'https://www.udemy.com/certificate/...',
    iconType: 'school',
    description: 'Web Dev, Spring Boot, DevOps Masterclass...',
  },
  {
    id: 'drive',
    name: 'Google Drive',
    prefix: 'https://drive.google.com/file/d/',
    placeholder: 'https://drive.google.com/file/d/.../view?usp=sharing',
    iconType: 'drive',
    description: 'Ảnh/PDF chứng chỉ (Bật chia sẻ công khai)',
  },
]

export interface CredentialVerificationInfo {
  url: string
  isValidUrl: boolean
  isTrusted: boolean
  isCloudStorage: boolean
  platformName: string
  badgeLabel: string
  badgeVariant: 'trusted' | 'course' | 'warning' | 'neutral'
  helperText: string
  tip?: string
}

export function analyzeCredentialUrl(
  url: string | null | undefined,
): CredentialVerificationInfo | null {
  if (!url || !url.trim()) return null
  const trimmed = url.trim()

  const invalidResult: CredentialVerificationInfo = {
    url: trimmed,
    isValidUrl: false,
    isTrusted: false,
    isCloudStorage: false,
    platformName: 'Đường dẫn',
    badgeLabel: 'URL không hợp lệ',
    badgeVariant: 'warning',
    helperText: 'Định dạng URL chưa đúng (ví dụ chuẩn: https://www.credly.com/badges/...)',
  }

  // Reject obvious malformed schemes like htp:// or broken characters
  if (/^[a-z0-9_-]+:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return invalidResult
  }

  let parsed: URL
  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    parsed = new URL(candidate)
    if (!parsed.hostname || !parsed.hostname.includes('.') || parsed.hostname.endsWith('.')) {
      return invalidResult
    }
  } catch {
    return invalidResult
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')

  if (host === 'credly.com' || host.endsWith('.credly.com')) {
    return {
      url: trimmed,
      isValidUrl: true,
      isTrusted: true,
      isCloudStorage: false,
      platformName: 'Credly',
      badgeLabel: 'Xác thực Credly',
      badgeVariant: 'trusted',
      helperText: 'Nguồn chứng chỉ chính thống. AI có thể tự động đối chiếu thông tin chứng chỉ và huy hiệu số.',
    }
  }

  if (host === 'coursera.org' || host.endsWith('.coursera.org')) {
    return {
      url: trimmed,
      isValidUrl: true,
      isTrusted: true,
      isCloudStorage: false,
      platformName: 'Coursera',
      badgeLabel: 'Xác thực Coursera',
      badgeVariant: 'trusted',
      helperText: 'Chứng chỉ học thuật uy tín. AI có thể trích xuất và đối chiếu mã chứng chỉ trực tuyến.',
    }
  }

  if (host === 'hackerrank.com' || host.endsWith('.hackerrank.com')) {
    return {
      url: trimmed,
      isValidUrl: true,
      isTrusted: true,
      isCloudStorage: false,
      platformName: 'HackerRank',
      badgeLabel: 'Xác thực HackerRank',
      badgeVariant: 'trusted',
      helperText: 'Chứng chỉ kiểm định kỹ năng lập trình đạt chuẩn thực tế từ HackerRank.',
    }
  }

  if (host === 'learn.microsoft.com') {
    return {
      url: trimmed,
      isValidUrl: true,
      isTrusted: true,
      isCloudStorage: false,
      platformName: 'Microsoft Learn',
      badgeLabel: 'Xác thực Microsoft',
      badgeVariant: 'trusted',
      helperText: 'Hồ sơ chứng chỉ công nghệ Microsoft chính thức, được nhà tuyển dụng tín nhiệm cao.',
    }
  }

  if (
    host === 'google.accredible.com' ||
    host === 'accredible.com' ||
    host.endsWith('.accredible.com') ||
    host === 'credential.net' ||
    host.endsWith('.credential.net') ||
    (host === 'cloud.google.com' && parsed.pathname.includes('/certification'))
  ) {
    return {
      url: trimmed,
      isValidUrl: true,
      isTrusted: true,
      isCloudStorage: false,
      platformName: 'Google Cloud / Accredible',
      badgeLabel: 'Xác thực Google Cloud / Accredible',
      badgeVariant: 'trusted',
      helperText: 'Hệ thống chứng chỉ số tiêu chuẩn. AI đối chiếu trực tiếp dữ liệu cấp bằng.',
    }
  }

  if (host === 'udemy.com' || host.endsWith('.udemy.com')) {
    return {
      url: trimmed,
      isValidUrl: true,
      isTrusted: true,
      isCloudStorage: false,
      platformName: 'Udemy',
      badgeLabel: 'Khóa học Udemy',
      badgeVariant: 'course',
      helperText: 'Chứng nhận hoàn thành khóa học chuyên môn trên nền tảng Udemy.',
    }
  }

  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    return {
      url: trimmed,
      isValidUrl: true,
      isTrusted: true,
      isCloudStorage: false,
      platformName: 'LinkedIn Learning',
      badgeLabel: 'LinkedIn Learning',
      badgeVariant: 'course',
      helperText: 'Chứng chỉ hoàn thành khóa học từ mạng lưới LinkedIn Learning.',
    }
  }

  if (
    host === 'drive.google.com' ||
    host === 'docs.google.com' ||
    host === 'dropbox.com' ||
    host.endsWith('.dropbox.com') ||
    host === 'onedrive.live.com' ||
    host === '1drv.ms' ||
    host === 'box.com' ||
    host.endsWith('.box.com')
  ) {
    return {
      url: trimmed,
      isValidUrl: true,
      isTrusted: false,
      isCloudStorage: true,
      platformName: 'Google Drive / Đám mây',
      badgeLabel: 'Lưu trữ đám mây',
      badgeVariant: 'warning',
      helperText: 'Lưu trữ cá nhân. Cần bật quyền "Bất kỳ ai có liên kết" để AI và nhà tuyển dụng có thể mở xem ảnh/PDF.',
      tip: 'Khuyên dùng link trực tiếp từ nền tảng cấp chứng chỉ (như Credly, Coursera...) để được gắn nhãn Xác thực chính thống.',
    }
  }

  return {
    url: trimmed,
    isValidUrl: true,
    isTrusted: false,
    isCloudStorage: false,
    platformName: host,
    badgeLabel: `Liên kết ngoài (${host})`,
    badgeVariant: 'neutral',
    helperText: 'Liên kết web bên ngoài. Đảm bảo trang web có thể truy cập công khai không yêu cầu đăng nhập mật khẩu.',
  }
}
