import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { uploadToR2 } from "@/lib/r2"

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const files: { name: string; url: string }[] = []

    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.size > 0) {
        const url = await uploadToR2(value, { folder: `companies/${key}` })
        if (url) {
          files.push({ name: key, url })
        }
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 })
    }

    return NextResponse.json({ files })
  } catch (error) {
    console.error("Upload failed:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
