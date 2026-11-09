export const sc = (n: number) => `${Math.round(n)}`

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m >= 1440) return `Il y a ${Math.floor(m / 1440)}j`
  if (m >= 60) return `Il y a ${Math.floor(m / 60)}h`
  if (m > 0) return `Il y a ${m}min`
  return "À l'instant"
}

export function expiresIn(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'Expiré'
  const m = Math.floor(diff / 60000)
  if (m >= 1440) return `Dans ${Math.floor(m / 1440)}j`
  if (m >= 60) return `Dans ${Math.floor(m / 60)}h`
  if (m > 0) return `Dans ${m}min`
  return 'Bientôt'
}

export function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} à ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatShort(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Lit un fichier image et le réduit (pour stocker les captures sans saturer le stockage). */
export function readImage(file: File, maxSize = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Image illisible'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
