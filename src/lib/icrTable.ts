import {ComparisonRow,comparisonCoefficient} from './icrComparisons';
import {formatIcrValue} from './icr';
import {agreementBreakdown,statisticName} from './icrStatistics';
export const comparisonTableHeaders=['Comparison','Statistic','Items',statisticName('percent'),'Coefficient',statisticName('holsti'),'Disagreement (%)','Both coded (%)','Neither coded (%)','Coded-only agreement (%)'];
export function comparisonTableRows(rows:ComparisonRow[]):Array<Array<string|number>> {
  const percent=(n:number|null|undefined)=>n===null||n===undefined?'—':n.toFixed(1);
  return rows.map(row=>{const parts=row.contingency?agreementBreakdown(row.contingency):undefined;return [row.label,statisticName(row.statistic),row.items,percent(row.agreement),comparisonCoefficient(row),row.holsti===undefined?'—':formatIcrValue(row.holsti),percent(parts?.disagreement),percent(parts?.bothCoded),percent(parts?.neitherCoded),percent(parts?.codedOnly)];});
}
