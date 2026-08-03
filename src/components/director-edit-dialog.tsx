"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type EditableDirector = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  address: string
}

/** Convert whatever date string we have into a value the date input accepts. */
function toDateInputValue(v: string): string {
  if (!v) return ""
  // Already ISO (yyyy-mm-dd) — keep the date part.
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(v)
  if (iso) return v.slice(0, 10)
  const d = new Date(v)
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10)
}

export function DirectorEditDialog({
  open,
  onOpenChange,
  organizationId,
  director,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  director: EditableDirector
  onSaved: () => void
}) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [dob, setDob] = useState("")
  const [address, setAddress] = useState("")

  // Reload the form whenever a different director opens.
  useEffect(() => {
    if (!open) return
    setFirstName(director.firstName ?? "")
    setLastName(director.lastName ?? "")
    setEmail(director.email ?? "")
    setPhone(director.phone ?? "")
    setDob(toDateInputValue(director.dateOfBirth ?? ""))
    setAddress(director.address ?? "")
  }, [open, director])

  const update = trpc.companies.updateDirector.useMutation({
    onSuccess: () => {
      toast.success("Director updated")
      onSaved()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const save = () => {
    if (!firstName.trim()) {
      toast.error("First name is required.")
      return
    }
    update.mutate({
      directorId: director.id,
      organizationId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      dateOfBirth: dob.trim(),
      address: address.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit director</DialogTitle>
          <DialogDescription>
            Update the director&apos;s details. Changes apply everywhere this
            director appears.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>First name *</Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Last name</Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="director@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Date of birth</Label>
            <Input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Textarea
              className="min-h-20"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City, State, ZIP"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
