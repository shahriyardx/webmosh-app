"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import {
  BoldIcon,
  ListIcon,
  ListOrderedIcon,
  ListChecksIcon,
  CheckIcon,
} from "lucide-react"

/* -------------------------------------------------------------------------- */
/*  Editor                                                                    */
/* -------------------------------------------------------------------------- */

type Edit = { text: string; selStart: number; selEnd: number }

const bulletRe = /^(\s*)[-*]\s+(?!\[[ xX]\])/
const numRe = /^(\s*)\d+\.\s+/
const checkRe = /^(\s*)[-*]\s+\[[ xX]\]\s+/
const anyMarker = /^(\s*)(?:[-*]\s+\[[ xX]\]\s+|[-*]\s+|\d+\.\s+)/

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  )
}

export function NoteEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const apply = (fn: (v: string, s: number, e: number) => Edit) => {
    const el = ref.current
    const s = el?.selectionStart ?? value.length
    const e = el?.selectionEnd ?? value.length
    const res = fn(value, s, e)
    onChange(res.text)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(res.selStart, res.selEnd)
    })
  }

  const wrap = (marker: string) => (v: string, s: number, e: number): Edit => {
    const sel = v.slice(s, e) || "text"
    const text = v.slice(0, s) + marker + sel + marker + v.slice(e)
    return {
      text,
      selStart: s + marker.length,
      selEnd: s + marker.length + sel.length,
    }
  }

  const toggleList =
    (kind: "bullet" | "number" | "check") =>
    (v: string, s: number, e: number): Edit => {
      const lineStart = v.lastIndexOf("\n", s - 1) + 1
      let lineEnd = v.indexOf("\n", e)
      if (lineEnd === -1) lineEnd = v.length
      const lines = v.slice(lineStart, lineEnd).split("\n")
      const re = kind === "bullet" ? bulletRe : kind === "number" ? numRe : checkRe
      const allHave = lines.every((l) => re.test(l))

      let out: string[]
      if (allHave) {
        out = lines.map((l) => l.replace(re, "$1"))
      } else {
        let n = 0
        out = lines.map((l) => {
          const stripped = l.replace(anyMarker, "$1")
          if (kind === "bullet") return stripped.replace(/^(\s*)/, "$1- ")
          if (kind === "check") return stripped.replace(/^(\s*)/, "$1- [ ] ")
          n += 1
          return stripped.replace(/^(\s*)/, `$1${n}. `)
        })
      }
      const newBlock = out.join("\n")
      return {
        text: v.slice(0, lineStart) + newBlock + v.slice(lineEnd),
        selStart: lineStart,
        selEnd: lineStart + newBlock.length,
      }
    }

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">
        <ToolbarButton title="Bold" onClick={() => apply(wrap("**"))}>
          <BoldIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Bulleted list"
          onClick={() => apply(toggleList("bullet"))}
        >
          <ListIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          onClick={() => apply(toggleList("number"))}
        >
          <ListOrderedIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Checklist"
          onClick={() => apply(toggleList("check"))}
        >
          <ListChecksIcon className="size-4" />
        </ToolbarButton>
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="min-h-24 resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Renderer                                                                  */
/* -------------------------------------------------------------------------- */

function renderInline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={`${keyBase}-${i}`} className="font-semibold text-foreground">
          {p.slice(2, -2)}
        </strong>
      )
    }
    return <span key={`${keyBase}-${i}`}>{p}</span>
  })
}

const isBullet = (l: string) => bulletRe.test(l)
const isNum = (l: string) => numRe.test(l)
const isCheck = (l: string) => checkRe.test(l)

/** Render the note's lightweight markdown (lists, numbers, checks, bold). */
export function NoteView({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const lines = text.replace(/\r/g, "").split("\n")
  const blocks: React.ReactNode[] = []
  let i = 0
  let k = 0

  while (i < lines.length) {
    const line = lines[i]
    if (isCheck(line)) {
      const items: { text: string; checked: boolean }[] = []
      while (i < lines.length && isCheck(lines[i])) {
        const m = lines[i].match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/)
        items.push({
          checked: (m?.[1] ?? " ").toLowerCase() === "x",
          text: m?.[2] ?? "",
        })
        i += 1
      }
      const key = k++
      blocks.push(
        <ul key={key} className="space-y-1">
          {items.map((it, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                  it.checked
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-muted-foreground/40",
                )}
              >
                {it.checked && <CheckIcon className="size-3" />}
              </span>
              <span className={it.checked ? "text-muted-foreground line-through" : ""}>
                {renderInline(it.text, `c${key}-${idx}`)}
              </span>
            </li>
          ))}
        </ul>,
      )
    } else if (isBullet(line)) {
      const items: string[] = []
      while (i < lines.length && isBullet(lines[i])) {
        items.push(lines[i].replace(bulletRe, "$1").trimStart())
        i += 1
      }
      const key = k++
      blocks.push(
        <ul key={key} className="list-disc space-y-0.5 pl-5">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `b${key}-${idx}`)}</li>
          ))}
        </ul>,
      )
    } else if (isNum(line)) {
      const items: string[] = []
      while (i < lines.length && isNum(lines[i])) {
        items.push(lines[i].replace(numRe, "$1").trimStart())
        i += 1
      }
      const key = k++
      blocks.push(
        <ol key={key} className="list-decimal space-y-0.5 pl-5">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `n${key}-${idx}`)}</li>
          ))}
        </ol>,
      )
    } else if (line.trim() === "") {
      i += 1
    } else {
      const para: string[] = []
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !isBullet(lines[i]) &&
        !isNum(lines[i]) &&
        !isCheck(lines[i])
      ) {
        para.push(lines[i])
        i += 1
      }
      const key = k++
      blocks.push(
        <p key={key}>
          {para.map((pl, idx) => (
            <span key={idx}>
              {renderInline(pl, `p${key}-${idx}`)}
              {idx < para.length - 1 && <br />}
            </span>
          ))}
        </p>,
      )
    }
  }

  return <div className={cn("space-y-2 text-sm", className)}>{blocks}</div>
}
