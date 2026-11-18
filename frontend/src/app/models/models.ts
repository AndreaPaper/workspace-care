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

