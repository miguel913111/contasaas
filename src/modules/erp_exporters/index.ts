/**
 * Exportador Global de ERPs
 * 
 * Centraliza as exportacoes para:
 * - TOConline (API REST)
 * - Primavera v10 (Excel)
 * - PHC CS (CSV / Raw Text)
 */

export { exportToToconline, mapInvoiceToToconline } from './toconlineExporter';
export { generatePrimaveraExcel } from './primaveraExporter';
export { generatePhcCsv, generatePhcRawText } from './phcExporter';
