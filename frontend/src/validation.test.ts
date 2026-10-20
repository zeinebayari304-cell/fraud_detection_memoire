import { describe, expect, it } from 'vitest'
import { PAGE_ROLES, canAccess } from './access'
import type { User } from './api'
import {
  parseFeatureLine,
  passwordStrength,
  validateConfirmation,
  validateEmail,
  validateFeatureValues,
  validateFullName,
  validatePassword,
  validateReference,
  validateUsername,
} from './validation'

describe("nom d'utilisateur", () => {
  it.each(['nadia', 'Nadia.B', 'karim_01', 'a-b'])('accepte %s', (value) => {
    expect(validateUsername(value)).toBe('')
  })
  it.each(['', 'ab', '1abc', 'nadia b', 'a'.repeat(31), 'nadia@'])('refuse « %s »', (value) => {
    expect(validateUsername(value)).not.toBe('')
  })
})

describe('e-mail', () => {
  it('accepte une adresse valide', () => expect(validateEmail('nadia@exemple.test')).toBe(''))
  it.each(['', 'pas-un-email', 'a@b', 'a b@c.tn'])('refuse « %s »', (value) => {
    expect(validateEmail(value)).not.toBe('')
  })
})

describe('mot de passe', () => {
  it('accepte un mot de passe conforme', () => expect(validatePassword('Fraude2026x')).toBe(''))
  it.each([
    ['court1A', 'au moins 8 caractères'],
    ['toutminuscule1', 'une majuscule'],
    ['TOUTMAJUSCULE1', 'une minuscule'],
    ['SansChiffreXX', 'un chiffre'],
    [' Espace2026x', "pas d'espace"],
  ])('refuse %s (%s)', (value, rule) => {
    expect(validatePassword(value)).toContain(rule)
  })
  it('refuse un mot de passe qui contient le nom d\'utilisateur', () => {
    expect(validatePassword('Karim2026x', 'karim')).toContain("nom d'utilisateur")
  })
  it('vérifie la confirmation', () => {
    expect(validateConfirmation('Fraude2026x', 'Fraude2026x')).toBe('')
    expect(validateConfirmation('Fraude2026x', 'Autre2026x')).toContain('ne correspondent pas')
    expect(validateConfirmation('Fraude2026x', '')).not.toBe('')
  })
  it('calcule une force croissante', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('abc')).toBeLessThan(passwordStrength('Fraude2026x'))
    expect(passwordStrength('Fraude2026x!long')).toBe(4)
  })
})

describe('autres champs', () => {
  it('nom complet facultatif mais contrôlé', () => {
    expect(validateFullName('')).toBe('')
    expect(validateFullName("Nadia Ben-Ali")).toBe('')
    expect(validateFullName('Nadia <script>')).not.toBe('')
  })
  it('référence de transaction', () => {
    expect(validateReference('TX-2026/001')).toBe('')
    expect(validateReference('<script>')).not.toBe('')
    expect(validateReference('x'.repeat(65))).not.toBe('')
  })
})

describe('variables de transaction', () => {
  const names = ['Time', ...Array.from({ length: 28 }, (_, i) => `V${i + 1}`), 'Amount']
  const valid = Object.fromEntries(names.map((n) => [n, '0']))

  it('accepte 30 nombres', () => expect(validateFeatureValues(valid)).toEqual({}))
  it('signale les champs vides, non numériques et négatifs', () => {
    const errors = validateFeatureValues({ ...valid, V3: '', V4: 'abc', Amount: '-1' })
    expect(Object.keys(errors).sort()).toEqual(['Amount', 'V3', 'V4'])
  })
  it('lit une ligne CSV collée', () => {
    const parsed = parseFeatureLine(names.map((_, i) => String(i)).join(','), names)
    expect(typeof parsed).toBe('object')
    expect((parsed as Record<string, string>).Amount).toBe('29')
  })
  it('refuse une ligne incomplète', () => {
    expect(typeof parseFeatureLine('1,2,3', names)).toBe('string')
  })
})

describe('accès aux pages (diagramme de cas d\'utilisation)', () => {
  const user = (role: User['role']) => ({ role } as User)

  it('tableau de bord pour tous les rôles', () => {
    for (const role of ['analyste', 'expert', 'admin'] as const) expect(canAccess(user(role), '/')).toBe(true)
  })
  it('analyse des transactions : analyste (et administrateur)', () => {
    for (const path of ['/transaction', '/csv', '/transactions']) {
      expect(canAccess(user('analyste'), path)).toBe(true)
      expect(canAccess(user('admin'), path)).toBe(true)
      expect(canAccess(user('expert'), path)).toBe(false)
    }
  })
  it('résultats scientifiques : expert (et administrateur)', () => {
    for (const path of ['/models', '/robustness', '/defense', '/final-model']) {
      expect(canAccess(user('expert'), path)).toBe(true)
      expect(canAccess(user('admin'), path)).toBe(true)
      expect(canAccess(user('analyste'), path)).toBe(false)
    }
  })
  it("l'administrateur accède à toutes les pages", () => {
    for (const path of Object.keys(PAGE_ROLES)) expect(canAccess(user('admin'), path)).toBe(true)
  })
  it('administration réservée à l\'administrateur', () => {
    for (const path of ['/users', '/audit']) {
      expect(canAccess(user('admin'), path)).toBe(true)
      expect(canAccess(user('analyste'), path)).toBe(false)
      expect(canAccess(user('expert'), path)).toBe(false)
    }
  })
  it('aucune page sans connexion', () => {
    for (const path of Object.keys(PAGE_ROLES)) expect(canAccess(null, path)).toBe(false)
  })
})
