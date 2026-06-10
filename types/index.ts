// ─── User & Auth ───────────────────────────────────────────────────────────────
export interface User {
  _id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'member' | 'guest'
  division: string
  avatar?: string
  createdAt: string
}

// ─── Initiative / KPI ──────────────────────────────────────────────────────────
export interface Initiative {
  _id: string
  code: string        // e.g. "SI-001"
  title: string
  description?: string
  planProgress: number   // cumulative plan % at current month
  actualProgress: number
  status: 'on_track' | 'at_risk' | 'delayed' | 'completed'
  milestones: Milestone[]
  phases: Phase[]
  pics: string[]         // user IDs
  year: number
  createdAt: string
  updatedAt: string
}

export interface Milestone {
  _id: string
  title: string
  targetDate: string
  actualDate?: string
  status: 'pending' | 'done' | 'delayed'
}

export interface Phase {
  _id: string
  name: string
  planPct: number
  actualPct: number
  planStartMonth: number   // 1–12
  planEndMonth: number
  actualStartMonth?: number
  actualEndMonth?: number
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed'
}

// ─── Issues ────────────────────────────────────────────────────────────────────
export interface Issue {
  _id: string
  initiativeId: string
  title: string
  description?: string
  progress: number        // 0–100
  status: 'on_track' | 'at_risk' | 'delayed' | 'completed'
  nextPlan: string
  dueDate: string
  pic: string             // user ID
  picName?: string
  progressHistory: ProgressEntry[]
  comments: Comment[]
  attachments: Attachment[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ProgressEntry {
  date: string
  progress: number
  note: string
  updatedBy: string
}

export interface Comment {
  _id: string
  text: string
  authorId: string
  authorName: string
  createdAt: string
}

export interface Attachment {
  _id: string
  name: string
  url: string
  uploadedAt: string
}

// ─── Attendance ────────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  _id: string
  userId: string
  date: string            // "YYYY-MM-DD"
  type: string            // from config (wfo, wfh, dinas, cuti, sakit, izin, etc.)
  note?: string
  createdAt: string
}

export interface AttendanceType {
  key: string
  label: string
  color: string       // bg hex
  textColor: string   // text hex
  icon?: string
  active: boolean
}

// ─── App Config ────────────────────────────────────────────────────────────────
export interface AppConfig {
  _id: string
  activeYear: number
  midYearMonth: number      // default 6
  midYearTarget: number     // default 50
  yearEndTarget: number     // default 100
  attendanceTypes: AttendanceType[]
  notifications: {
    waEnabled: boolean
    waDueDateReminder: boolean
    waWeeklyDigest: boolean
    digestDayOfWeek: number   // 5 = Friday
    digestHour: number
  }
  roles: {
    managerCanEditAll: boolean
    memberSeeOwnOnly: boolean
    guestViewEnabled: boolean
  }
  updatedAt: string
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
export interface DashboardStats {
  totalInitiatives: number
  avgProgress: number
  onTrackCount: number
  atRiskCount: number
  overdueItems: OverdueItem[]
  workloadByPic: WorkloadItem[]
}

export interface OverdueItem {
  issueId: string
  issueTitle: string
  initiativeTitle: string
  planPct: number
  actualPct: number
  gap: number
  pic: string
}

export interface WorkloadItem {
  name: string
  count: number
  color: string
}
