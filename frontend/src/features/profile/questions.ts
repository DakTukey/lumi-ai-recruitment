// Fixed onboarding copy and input choices. Company-supported options come from the API.
export const steps = [
  {
    title: 'Công việc mong muốn',
    description:
      'Bạn muốn tìm công việc nào tại Lumi? Chia sẻ định hướng của bạn, kể cả khi chưa có vị trí đang tuyển.',
  },
  {
    title: 'Kinh nghiệm & kỹ năng',
    description:
      'Bạn có kinh nghiệm gì liên quan đến công việc mong muốn? Mới bắt đầu cũng hoàn toàn được.',
  },
  {
    title: 'Cách làm việc',
    description: 'Bạn muốn làm việc như thế nào? Có thể chọn nhiều phương án phù hợp với mình.',
  },
]
export const employmentLabels: Record<string, string> = {
  FULL_TIME: 'Toàn thời gian',
  PART_TIME: 'Bán thời gian',
  INTERNSHIP: 'Thực tập',
  CONTRACT: 'Hợp đồng',
}
export const modeLabels: Record<string, string> = {
  ONSITE: 'Tại văn phòng',
  HYBRID: 'Kết hợp văn phòng và từ xa',
  REMOTE: 'Từ xa',
}
export const experienceLabels: Record<string, string> = {
  NONE: 'Chưa có kinh nghiệm',
  UNDER_ONE: 'Dưới 1 năm',
  ONE_TO_THREE: 'Từ 1 đến dưới 3 năm',
  THREE_TO_FIVE: 'Từ 3 đến dưới 5 năm',
  FIVE_PLUS: 'Từ 5 năm trở lên',
}
