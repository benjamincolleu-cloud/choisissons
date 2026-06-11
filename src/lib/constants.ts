import type { ElementType } from 'react'
import {
    Sprout, Users, Vote, CheckCircle, XCircle,
    Lock, BookOpen, Calendar,
} from 'lucide-react'
import type { Stage, VoteChoice, Proposal, ParliamentaryLaw, Organisation } from '../types'

export const ADMIN_EMAILS: string[] = ['benjamin@choisissons.fr', 'benjamin.colleu@gmail.com']

export const VOTE_CHOICE_LABEL: Record<VoteChoice, string> = { pour: 'Pour', contre: 'Contre', blanc: 'Blanc' }
export const VOTE_CHOICE_BADGE: Record<VoteChoice, string> = {
  pour: 'bg-green-100 text-green-700',
  contre: 'bg-red-100 text-red-600',
  blanc: 'bg-slate-100 text-slate-600',
}

export const STAGE_CONFIG: Record<Stage, { label: string; color: string; icon: ElementType; description: string }> = {
  seedling: { label: 'Pépinière', color: 'bg-emerald-100 text-emerald-700', icon: Sprout, description: 'En cours de signatures' },
  review: { label: 'Jury citoyen', color: 'bg-amber-100 text-amber-700', icon: Users, description: 'Examinée par le jury' },
  voting: { label: 'Vote ouvert', color: 'bg-indigo-100 text-indigo-700', icon: Vote, description: 'Votez maintenant' },
  adopted: { label: 'Adoptée', color: 'bg-green-100 text-green-700', icon: CheckCircle, description: 'Proposition adoptée' },
  rejected: { label: 'Rejetée', color: 'bg-red-100 text-red-700', icon: XCircle, description: 'Proposition rejetée' },
  closed: { label: 'Clôturé', color: 'bg-teal-100 text-teal-700', icon: Lock, description: 'Vote clôturé et ancré' },
  archived: { label: 'Archivée', color: 'bg-slate-100 text-slate-700', icon: BookOpen, description: 'Proposition archivée' },
  upcoming: { label: 'À venir', color: 'bg-amber-100 text-amber-700', icon: Calendar, description: 'Vote à l\'Assemblée à venir' },
}

export const PROPOSALS: Proposal[] = [
  {
    id: '1',
    title: 'Revenu universel de base à 800€/mois',
    description: "Instaurer un revenu universel de base de 800€ mensuels pour tous les citoyens français majeurs, financé par une réforme fiscale progressive.",
    category: 'Économie',
    stage: 'voting',
    votes: { pour: 0, contre: 0, blanc: 0 },
    signatures: 15000,
    targetSignatures: 10,
    arguments: [
      { id: 'a1', type: 'pour', text: 'Élimine la pauvreté et donne à chacun la liberté de choisir son travail.', author: 'Marie L.', likes: 342 },
      { id: 'a2', type: 'pour', text: 'Soutient les artistes, entrepreneurs et aidants familiaux non rémunérés.', author: 'Thomas B.', likes: 289 },
      { id: 'a3', type: 'contre', text: 'Le coût estimé à 600 milliards pourrait déstabiliser les finances publiques.', author: 'Jean-Pierre M.', likes: 198 },
      { id: 'a4', type: 'contre', text: 'Risque de désincentiver le travail et créer une inflation sur les loyers.', author: 'Sophie R.', likes: 156 },
    ],
    author: 'Collectif RUB',
    date: '2026-01-15',
    tags: ['économie', 'social', 'travail'],
  },
  {
    id: '2',
    title: "Interdiction des pesticides en zones urbaines",
    description: "Interdire l'utilisation de pesticides chimiques à moins de 500 mètres des habitations et dans tous les espaces verts publics.",
    category: 'Environnement',
    stage: 'review',
    votes: { pour: 0, contre: 0, blanc: 0 },
    signatures: 4200,
    targetSignatures: 10,
    arguments: [
      { id: 'b1', type: 'pour', text: 'Protège la santé des enfants et des personnes vulnérables vivant près des zones traitées.', author: 'Association Santé Verte', likes: 412 },
      { id: 'b2', type: 'pour', text: 'Favorise la biodiversité urbaine et le retour des pollinisateurs.', author: 'Dr. Camille F.', likes: 267 },
      { id: 'b3', type: 'contre', text: 'Les alternatives bio sont plus coûteuses et moins efficaces pour les communes.', author: 'Fédération Jardins', likes: 89 },
    ],
    author: 'Alliance Écologie Urbaine',
    date: '2026-02-03',
    tags: ['environnement', 'santé', 'biodiversité'],
  },
]

export const ZERO_ASSEMBLEE_LAW = { assembleePour: 0, assembleeContre: 0, assembleeAbstention: 0, assembleeSort: '' }

export const PARLIAMENTARY_LAWS_INITIAL: ParliamentaryLaw[] = [
  {
    id: 'law-1',
    number: 'n°324',
    title: 'PLF 2026 — Projet de Loi de Finances',
    description: "Définit le budget de l'État pour 2026 : dépenses publiques, recettes fiscales et réforme de la TVA sur les produits de première nécessité. Enveloppe totale : 492 milliards d'euros.",
    resume: '',
    category: 'Économie',
    stage: 'voting',
    parliamentVoteDate: '22 avril 2026',
    votes: { pour: 0, contre: 0, blanc: 0 },
    ...ZERO_ASSEMBLEE_LAW,
    tags: ['budget', 'fiscalité', 'économie'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/16/textes/l16b0324_projet-loi',
  },
]

export const MOCK_ORGANISATIONS: Organisation[] = [
  { id: 'org-1', name: 'Paris 11e', type: 'commune', description: 'Mairie du 11e arrondissement de Paris', population: 152000 },
  { id: 'org-2', name: 'Lyon 3e', type: 'commune', description: 'Mairie du 3e arrondissement de Lyon', population: 47000 },
]

export const WORKFLOW_STEPS = [
  {
    label: 'Pépinière',
    description: 'Proposez une idée. Elle devient publique après 10 soutiens citoyens.',
  },
  {
    label: 'Jury',
    description: '100 citoyens tirés au sort vérifient la neutralité et la légalité du texte.',
  },
  {
    label: 'Isoloir',
    description: 'Votez Pour, Contre ou Blanc. Votre vote est anonyme et chiffré SHA-256.',
  },
  {
    label: 'Décision',
    description: 'Si le quorum est atteint, la proposition devient une décision citoyenne officielle.',
  },
]

export const FR_MOIS: Record<string, number> = {
  janvier: 0, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, août: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11,
}
export const CITIZEN_VOTE_DAYS = 14

export const MIN_VOTES_FOR_PCT = 20

export const COMMUNE_TIERS = [
  { value: 'small', label: 'Moins de 5 000 habitants', price: '49€' },
  { value: 'medium', label: 'De 5 000 à 50 000 habitants', price: '149€' },
  { value: 'large', label: 'Plus de 50 000 habitants', price: '499€' },
] as const
export type CommuneTier = typeof COMMUNE_TIERS[number]['value']

export const COMMUNE_PLAN_MAP: Record<CommuneTier, string> = {
  small: 'commune_petite',
  medium: 'commune_moyenne',
  large: 'commune_grande',
}

export const ASSOC_TIERS = [
  { value: 's', label: "Jusqu'à 50 adhérents", price: '9€' },
  { value: 'm', label: "Jusqu'à 200 adhérents", price: '19€' },
  { value: 'l', label: 'Adhérents illimités', price: '49€' },
] as const
export type AssocTier = typeof ASSOC_TIERS[number]['value']

export const ASSOC_PLAN_MAP: Record<AssocTier, string> = {
  s: 'assoc_s',
  m: 'assoc_m',
  l: 'assoc_l',
}

export const STRIPE_PRODUCT_IDS: Record<string, string> = {
  citoyen: 'prod_UarythbFH8E5hs',
  media: 'prod_UarzuwtLFr24b3',
  ong: 'prod_UarzdtYPKStpea',
  assoc_s: 'prod_Uas37yPOMHouwu',
  assoc_m: 'prod_Uas4bJ3ZTxSv9i',
  assoc_l: 'prod_Uas5VkdubNnzPK',
  commune_petite: 'prod_Uas0rN3qtJiScl',
  commune_moyenne: 'prod_Uas1PSHZycVXkh',
  commune_grande: 'prod_Uas2pkPYdwxQ1h',
}

export const IMPACT_CATEGORIES: { name: string; color: string }[] = [
  { name: 'Économie', color: 'bg-yellow-400' },
  { name: 'Social', color: 'bg-blue-400' },
  { name: 'Numérique', color: 'bg-purple-400' },
  { name: 'Institutions', color: 'bg-indigo-400' },
  { name: 'Environnement', color: 'bg-green-400' },
  { name: 'Justice', color: 'bg-violet-400' },
]
