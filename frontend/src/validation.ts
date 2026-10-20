/**
 * Contrôle de saisie côté interface : mêmes règles que le serveur
 * (backend/schemas.py). Chaque fonction renvoie un message d'erreur, ou ''.
 */

export const USERNAME_RE = /^[A-Za-z][A-Za-z0-9._-]{2,29}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const FULL_NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]{2,100}$/

export function validateUsername(value: string): string {
  if (!value.trim()) return "Le nom d'utilisateur est obligatoire."
  if (!USERNAME_RE.test(value.trim())) {
    return "3 à 30 caractères, commence par une lettre (lettres, chiffres, . _ -)."
  }
  return ''
}

export function validateEmail(value: string): string {
  if (!value.trim()) return "L'adresse e-mail est obligatoire."
  if (!EMAIL_RE.test(value.trim()) || value.trim().length > 254) {
    return 'Adresse e-mail invalide.'
  }
  return ''
}

/** Règles manquantes du mot de passe (liste vide = mot de passe accepté). */
export function passwordProblems(value: string): string[] {
  const problems: string[] = []
  if (value.length < 8) problems.push('au moins 8 caractères')
  if (value.length > 64 || new TextEncoder().encode(value).length > 72) {
    problems.push('au plus 64 caractères')
  }
  if (!/[a-z]/.test(value)) problems.push('une minuscule')
  if (!/[A-Z]/.test(value)) problems.push('une majuscule')
  if (!/\d/.test(value)) problems.push('un chiffre')
  if (value !== value.trim()) problems.push("pas d'espace au début ni à la fin")
  return problems
}

export function validatePassword(value: string, username = ''): string {
  if (!value) return 'Le mot de passe est obligatoire.'
  const problems = passwordProblems(value)
  if (problems.length) return `Mot de passe trop faible : ${problems.join(', ')}.`
  if (username.trim() && value.toLowerCase().includes(username.trim().toLowerCase())) {
    return "Le mot de passe ne doit pas contenir le nom d'utilisateur."
  }
  return ''
}

export function validateConfirmation(password: string, confirmation: string): string {
  if (!confirmation) return 'Confirmez le mot de passe.'
  return password === confirmation ? '' : 'Les deux mots de passe ne correspondent pas.'
}

export function validateFullName(value: string): string {
  if (!value.trim()) return ''
  return FULL_NAME_RE.test(value.trim().replace(/\s+/g, ' '))
    ? ''
    : 'Nom complet : 2 à 100 lettres (espaces, tirets et apostrophes permis).'
}

/** Force du mot de passe sur 4 (pour l'indicateur visuel). */
export function passwordStrength(value: string): number {
  if (!value) return 0
  let score = 4 - Math.min(4, passwordProblems(value).length)
  if (score === 4 && value.length < 12 && !/[^A-Za-z0-9]/.test(value)) score = 3
  return score
}

export function validateReference(value: string): string {
  if (!value.trim()) return ''
  if (value.trim().length > 64) return 'Référence : 64 caractères au maximum.'
  return /^[\w .:/#-]+$/.test(value.trim())
    ? ''
    : 'Référence : lettres, chiffres, espaces et . : / # - _ uniquement.'
}

export function validateDescription(value: string): string {
  return value.trim().length > 500 ? 'Description : 500 caractères au maximum.' : ''
}

/** Valide les 30 variables d'une transaction saisies sous forme de texte. */
export function validateFeatureValues(values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const [name, raw] of Object.entries(values)) {
    if (raw.trim() === '') errors[name] = 'Obligatoire.'
    else if (!Number.isFinite(Number(raw))) errors[name] = 'Nombre attendu.'
    else if ((name === 'Time' || name === 'Amount') && Number(raw) < 0) {
      errors[name] = 'Doit être positif ou nul.'
    }
  }
  return errors
}

/** Remplit les 30 variables à partir d'une ligne collée (CSV « Time,V1,…,V28,Amount »). */
export function parseFeatureLine(line: string, names: string[]): Record<string, string> | string {
  const parts = line.trim().split(/[;,\t]/).map((part) => part.trim())
  if (parts.length < names.length) {
    return `${names.length} valeurs attendues (Time, V1…V28, Amount), ${parts.length} reçues.`
  }
  const values = Object.fromEntries(names.map((name, i) => [name, parts[i]]))
  return Object.values(validateFeatureValues(values)).length
    ? 'Certaines valeurs ne sont pas des nombres valides.'
    : values
}
