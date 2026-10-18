/** Stable IDs are used in calculations; these names are shared by UI and exports. */
export const icrStatistics = {
  percent: { name: 'Percentage agreement (%)', symbol: '%' },
  cohen: { name: 'Cohen’s kappa (κ)', symbol: 'κ' },
  fleiss: { name: 'Fleiss’ kappa (κ)', symbol: 'κ' },
  binary: { name: 'Krippendorff’s alpha (α), nominal binary', symbol: 'α' },
  nominal: { name: 'Krippendorff’s alpha (α), nominal', symbol: 'α' },
  domain: { name: 'Semantic-domain cu-alpha', symbol: 'α' },
  exploratory: { name: 'Exploratory global domain-set alpha', symbol: 'α' },
  brennan: { name: 'Brennan–Prediger kappa (κ)', symbol: 'κ' },
  rk: { name: 'Rädiker–Kuckartz kappa (RK)', symbol: 'κ' },
  pearson: { name: 'Pearson’s correlation coefficient (r)', symbol: 'r' },
  holsti: { name: 'Holsti index', symbol: '' },
} as const;
export type IcrStatistic = keyof typeof icrStatistics;
export const statisticName = (id: IcrStatistic) => icrStatistics[id].name;
export function agreementBreakdown(t:{bothYes:number;aOnly:number;bOnly:number;bothNo:number;n:number}) {
  const positive=t.bothYes+t.aOnly+t.bOnly;
  return {disagreement:t.n?100*(t.aOnly+t.bOnly)/t.n:null,bothCoded:t.n?100*t.bothYes/t.n:null,neitherCoded:t.n?100*t.bothNo/t.n:null,codedOnly:positive?100*t.bothYes/positive:null};
}
