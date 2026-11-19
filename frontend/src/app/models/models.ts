import { RecordModel } from 'pocketbase';

const RAW_CATEGORIES = [
  { value: 'arredo', label: 'Arredo' },
  { value: 'manutenzione', label: 'Manutenzione' },
  { value: 'organizzazione', label: 'Organizzazione' },
  { value: 'regole', label: 'Regole' },
  { value: 'benessere', label: 'Benessere' },
] as const;

const RAW_STATUSES = [
  { value: 'idea', label: 'Idea' },
  { value: 'da_valutare', label: 'Da valutare' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'approvata', label: 'Approvata' },
  { value: 'in_corso', label: 'In corso' },
  { value: 'fatta', label: 'Fatta' },
  { value: 'scartata', label: 'Scartata' },
] as const;

const RAW_PRIORITIES = [
  { value: 'bassa', label: 'Bassa' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
] as const;

export const IDEA_CATEGORIES = [...RAW_CATEGORIES];
export const IDEA_STATUSES = [...RAW_STATUSES];
export const IDEA_PRIORITIES = [...RAW_PRIORITIES];

export type IdeaCategory = (typeof RAW_CATEGORIES)[number]['value'];
export type IdeaStatus = (typeof RAW_STATUSES)[number]['value'];
export type IdeaPriority = (typeof RAW_PRIORITIES)[number]['value'];
export type PreviewStatus = 'ok' | 'parziale' | 'fallita' | '';

export interface Area extends RecordModel {
  nome: string;
}

export interface Idea extends RecordModel {
  titolo: string;
  descrizione: string;
  categoria: IdeaCategory | '';
  area: string;
  stato: IdeaStatus;
  priorita: IdeaPriority | '';
  costo_min: number;
  costo_max: number;
  foto: string[];
  note: string;
  updated: string;
  expand?: { area?: Area };
}

export interface IdeaLink extends RecordModel {
  idea: string;
  url: string;
  titolo: string;
  sito: string;
  immagine: string;
  immagine_url: string;
  prezzo: string;
  stato_anteprima: PreviewStatus;
}

export const labelOf = (list: readonly { value: string; label: string }[], value: string): string =>
  list.find((i) => i.value === value)?.label ?? value;


export const CHECK_FREQUENCIES = [
  { value: 'settimanale', label: 'Settimanale' },
  { value: 'bisettimanale', label: 'Ogni 2 settimane' },
  { value: 'mensile', label: 'Mensile' },
  { value: 'trimestrale', label: 'Trimestrale' },
];

export const CHECK_OUTCOMES = [
  { value: 'ok', label: 'Tutto a posto' },
  { value: 'da_sistemare', label: 'Da sistemare' },
];

export const WEEKDAYS = [
  { value: 1, label: 'Lunedì' },
  { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' },
  { value: 6, label: 'Sabato' },
  { value: 7, label: 'Domenica' },
];

export const REQUEST_STATUSES = [
  { value: 'ricevuta', label: 'Ricevuta' },
  { value: 'in_valutazione', label: 'In valutazione' },
  { value: 'in_corso', label: 'In corso' },
  { value: 'fatta', label: 'Fatta' },
  { value: 'non_fattibile', label: 'Non fattibile' },
];

export type CheckFrequency = 'settimanale' | 'bisettimanale' | 'mensile' | 'trimestrale';
export type CheckOutcome = 'ok' | 'da_sistemare';
export type RequestStatus = 'ricevuta' | 'in_valutazione' | 'in_corso' | 'fatta' | 'non_fattibile';

export interface Check extends RecordModel {
  nome: string;
  area: string;
  frequenza: CheckFrequency;
  giorno: number;
  prossima_scadenza: string;
  expand?: { area?: Area };
}

export interface CheckRun extends RecordModel {
  controllo: string;
  data: string;
  esito: CheckOutcome | '';
  note: string;
}

export interface WorkRequest extends RecordModel {
  titolo: string;
  descrizione: string;
  richiedente: string;
  area: string;
  data: string;
  stato: RequestStatus;
  idea: string;
  note: string;
  updated: string;
  expand?: { area?: Area; idea?: Idea };
}

export const PURCHASE_STATUSES = [
  { value: 'da_proporre', label: 'Da proporre' },
  { value: 'approvato', label: 'Approvato' },
  { value: 'ordinato', label: 'Ordinato' },
  { value: 'arrivato', label: 'Arrivato' },
  { value: 'montato', label: 'Montato' },
];

export type PurchaseStatus = 'da_proporre' | 'approvato' | 'ordinato' | 'arrivato' | 'montato';

export interface Purchase extends RecordModel {
  articolo: string;
  area: string;
  quantita: number;
  idea: string;
  fornitore: string;
  link: string;
  stima_min: number;
  stima_max: number;
  prezzo_effettivo: number;
  stato: PurchaseStatus;
  data_acquisto: string;
  expand?: { area?: Area; idea?: Idea };
}

export const RULE_TOPICS = [
  { value: 'cassettiere', label: 'Cassettiere' },
  { value: 'cucina', label: 'Cucina' },
  { value: 'frigorifero', label: 'Frigorifero' },
  { value: 'altro', label: 'Altro' },
];

export const RULE_STATUSES = [
  { value: 'da_definire', label: 'Da definire' },
  { value: 'bozza', label: 'Bozza' },
  { value: 'attiva', label: 'Attiva' },
];

export type DrawerType = 'personale' | 'condiviso' | 'libero';
export type RuleTopic = 'cassettiere' | 'cucina' | 'frigorifero' | 'altro';
export type RuleStatus = 'da_definire' | 'bozza' | 'attiva';

export interface InventoryItem extends RecordModel {
  nome: string;
  area: string;
  /** Where inside the container (shelf, drawer…). */
  posizione: string;
  note: string;
  /** Optional container (cabinet, box…); empty when the item is loose in its area. */
  contenitore: string;
  expand?: { area?: Area };
}

/** A cabinet, a box or a shelf unit that holds inventory items. */
export interface Container extends RecordModel {
  nome: string;
  area: string;
  descrizione: string;
}

/** A drawer unit (cassettiera): a numbered piece of furniture in an area, made of single drawers. */
export interface DrawerUnit extends RecordModel {
  numero: number;
  area: string;
  expand?: { area?: Area };
}

/** One drawer (cassetto) of a unit: personal (assigned to a person), shared (with a content) or free. */
export interface Drawer extends RecordModel {
  cassettiera: string;
  numero: number;
  tipo: DrawerType;
  assegnato_a: string;
  contenuto: string;
}

export interface Rule extends RecordModel {
  tema: RuleTopic;
  testo: string;
  stato: RuleStatus;
  /** Optional: the area the rule is about (shown on the area page). */
  area: string;
}

/** One line of a request's history: status changes are written by the server, notes by the app. */
export interface RequestEvent extends RecordModel {
  richiesta: string;
  tipo: 'stato' | 'nota';
  testo: string;
  data: string;
}
