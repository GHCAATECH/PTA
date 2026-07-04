export async function studentLoginEmail(admissionNumber: string) {
  const bytes=new TextEncoder().encode(admissionNumber.trim().toUpperCase())
  const digest=await crypto.subtle.digest('SHA-256',bytes)
  const hex=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')
  return `s.${hex}@students.apex.edu.gh`
}
