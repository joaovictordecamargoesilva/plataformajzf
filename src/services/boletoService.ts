import { jsPDF } from 'jspdf';
import type { Invoice, Client } from '../types';
import { JZF_LOGO_BASE64 } from '../constants';

/**
 * Generates a simulated boleto PDF using jsPDF and returns it as a base64 data URI.
 * @param invoice - The invoice data (without id and status).
 * @param client - The client data.
 * @returns A base64 encoded string of the generated PDF.
 */
export const generateBoletoPdf = (invoice: Omit<Invoice, 'id' | 'status' | 'paymentMethods'>, client: Client): string => {
    const doc = new jsPDF();
    const primaryColor = '#922c26';

    // Header with Logo
    if (JZF_LOGO_BASE64) {
        try {
            const logoWidth = 50;
            const logoHeight = 13.3; // Maintain 300x80 aspect ratio
            doc.addImage(JZF_LOGO_BASE64, 'SVG', 14, 10, logoWidth, logoHeight);
        } catch(e) {
            console.error("Failed to add logo to PDF, falling back to text.", e);
            // Fallback to text if logo is not available or fails to load
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(primaryColor);
            doc.text('JZF Contabilidade', 14, 20);
        }
    } else {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor);
        doc.text('JZF Contabilidade', 14, 20);
    }
    
    doc.setFontSize(10);
    doc.setTextColor('#333333');
    doc.text('BOLETO DE COBRANÇA (SIMULAÇÃO)', 14, 28);
    doc.setDrawColor(primaryColor);
    doc.line(14, 32, 196, 32);

    // Body (Y positions adjusted for logo)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Beneficiário:', 14, 42);
    doc.text('JZF Contabilidade - CNPJ: 00.000.000/0001-00', 50, 42);

    doc.text('Pagador:', 14, 52);
    doc.text(`${client.name} - ${client.company}`, 50, 52);

    doc.text('Descrição:', 14, 62);
    doc.text(invoice.description, 50, 62);

    doc.text('Vencimento:', 14, 72);
    doc.setFont('helvetica', 'bold');
    doc.text(new Date(invoice.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }), 50, 72);

    doc.text('Valor:', 14, 82);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${invoice.amount.toFixed(2)}`, 50, 82);

    // Fake barcode
    doc.setFontSize(8);
    doc.text('Linha Digitável (simulação):', 14, 100);
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.text('12345.12345 12345.123456 12345.123456 1 12345678901234', 14, 105);

    // Return as base64 data URI
    return doc.output('datauristring');
};