import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { InitiativeModel } from '@/models/Initiative'
import { IssueModel } from '@/models/Issue'

export async function GET() {
  try {
    await connectDB()
    const [initiatives, issues] = await Promise.all([
      InitiativeModel.find({ year: 2026 }).lean(),
      IssueModel.find({}).lean(),
    ])

    const avgProgress = initiatives.length
      ? Math.round(initiatives.reduce((s, i) => s + i.actualProgress, 0) / initiatives.length)
      : 0

    const onTrack = initiatives.filter((i) => i.status === 'on_track').length
    const atRisk = initiatives.filter((i) => i.status === 'at_risk' || i.status === 'delayed').length

    // Overdue items: issues where progress lags plan significantly
    const overdueItems = issues
      .filter((i) => {
        const initiative = initiatives.find((ini) => ini._id.toString() === i.initiativeId.toString())
        if (!initiative) return false
        return i.status === 'delayed' || i.status === 'at_risk'
      })
      .map((i) => {
        const initiative = initiatives.find((ini) => ini._id.toString() === i.initiativeId.toString())
        return {
          issueId: i._id.toString(),
          issueTitle: i.title,
          initiativeTitle: initiative?.title || '',
          planPct: initiative?.planProgress || 0,
          actualPct: i.progress,
          gap: (initiative?.planProgress || 0) - i.progress,
          pic: i.picName || i.pic,
        }
      })
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 5)

    // Workload by PIC
    const picMap: Record<string, number> = {}
    initiatives.forEach((ini) => {
      ini.pics.forEach((p: string) => {
        picMap[p] = (picMap[p] || 0) + 1
      })
    })
    const colors = ['#4f8ef7', '#a78bfa', '#2dd4bf', '#f59e0b', '#22c55e', '#ef4444']
    const workloadByPic = Object.entries(picMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({ name, count, color: colors[i % colors.length] }))

    return NextResponse.json({
      data: {
        totalInitiatives: initiatives.length,
        avgProgress,
        onTrackCount: onTrack,
        atRiskCount: atRisk,
        overdueItems,
        workloadByPic,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
