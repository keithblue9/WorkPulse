import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

// Client-upload flow: browser upload file langsung ke Vercel Blob (bypass limit body serverless).
// Endpoint ini hanya mengeluarkan token & menerima callback selesai.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname) => ({
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
        maximumSizeInBytes: 15 * 1024 * 1024, // 15 MB per file
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({}),
      }),
      onUploadCompleted: async () => { /* no-op: URL disimpan di reimbursement doc oleh client */ },
    })
    return NextResponse.json(json)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
