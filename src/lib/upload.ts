export async function uploadFiles(files: File[], key = "attachment"): Promise<string[]> {
  if (files.length === 0) return []
  const fd = new FormData()
  files.forEach((f) => fd.append(key, f))
  const res = await fetch("/api/upload", { method: "POST", body: fd })
  if (!res.ok) throw new Error("Upload failed")
  const data: { files: { name: string; url: string }[] } = await res.json()
  return data.files.map((f) => f.url)
}
