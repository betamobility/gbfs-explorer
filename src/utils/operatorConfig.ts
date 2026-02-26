import { GBFSSystem } from './gbfsUtils';

export const TOP_OPERATORS = [
  { id: "voi",      name: "Voi",      match: /\bvoi\b/i },
  { id: "ryde",     name: "Ryde",     match: /\bryde\b/i },
  { id: "bolt",     name: "Bolt",     match: /\bbolt\b/i },
  { id: "lime",     name: "Lime",     match: /\blime\b/i },
  { id: "nextbike", name: "Nextbike", match: /\bnextbike\b/i },
  { id: "tier",     name: "Tier",     match: /\btier\b(?!.*nextbike)/i },
  { id: "dott",     name: "Dott",     match: /\bdott\b/i },
] as const;

export type OperatorId = typeof TOP_OPERATORS[number]["id"];

export function isValidOperatorId(id: string): id is OperatorId {
  return TOP_OPERATORS.some(op => op.id === id);
}

export function getOperatorById(id: OperatorId) {
  return TOP_OPERATORS.find(op => op.id === id);
}

export function matchOperator(operatorId: OperatorId, system: GBFSSystem): boolean {
  const op = TOP_OPERATORS.find(o => o.id === operatorId);
  if (!op) return false;
  return op.match.test(system.name) || op.match.test(system.provider ?? "");
}

export function getSystemsForOperator(operatorId: OperatorId, allSystems: GBFSSystem[]): GBFSSystem[] {
  return allSystems.filter(s => matchOperator(operatorId, s));
}
