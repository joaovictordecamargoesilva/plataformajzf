import { jsPDF } from 'jspdf';
import type { Invoice, Client } from '../types';

/**
 * Generates a simulated boleto PDF using jsPDF and returns it as a base64 data URI.
 * @param invoice - The invoice data (without id and status).
 * @param client - The client data.
 * @returns A base64 encoded string of the generated PDF.
 */
export const generateBoletoPdf = (invoice: Omit<Invoice, 'id' | 'status' | 'boletoPdf'>, client: Client): string => {
    const doc = new jsPDF();
    const primaryColor = '#922c26';

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor);
    doc.text('JZF Contabilidade', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor('#333333');
    doc.text('BOLETO DE COBRANÇA (SIMULAÇÃO)', 14, 26);
    doc.setDrawColor(primaryColor);
    doc.line(14, 30, 196, 30);

    // Body
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Beneficiário:', 14, 40);
    doc.text('JZF Contabilidade - CNPJ: 00.000.000/0001-00', 50, 40);

    doc.text('Pagador:', 14, 50);
    doc.text(`${client.name} - ${client.company}`, 50, 50);

    doc.text('Descrição:', 14, 60);
    doc.text(invoice.description, 50, 60);

    doc.text('Vencimento:', 14, 70);
    doc.setFont('helvetica', 'bold');
    doc.text(new Date(invoice.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }), 50, 70);

    doc.text('Valor:', 14, 80);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${invoice.amount.toFixed(2)}`, 50, 80);

    // Fake barcode
    doc.setFontSize(8);
    doc.text('Linha Digitável (simulação):', 14, 95);
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.text('12345.12345 12345.123456 12345.123456 1 12345678901234', 14, 100);

    // Return as base64 data URI
    return doc.output('datauristring');
};