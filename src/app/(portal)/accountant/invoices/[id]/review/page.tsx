import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types';
import InvoiceReviewForm from './InvoiceReviewForm';

export default async function InvoiceReviewPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ACCOUNTANT) {
    redirect('/selfservice/dashboard');
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { company: true, lines: true },
  });

  if (!invoice) {
    redirect('/accountant/invoices');
  }

  // Verifica se o contabilista tem acesso a esta fatura
  if (invoice.company.accountantId !== session.user.id) {
    redirect('/accountant/invoices');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Revisao de Fatura</h2>
        <a
          href="/accountant/invoices"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← Voltar a lista
        </a>
      </div>

      <InvoiceReviewForm
        invoiceId={invoice.id}
        initialData={{
          documentNumber: invoice.documentNumber,
          supplierName: invoice.supplierName || '',
          supplierNif: invoice.supplierNif || '',
          date: invoice.date.toISOString().split('T')[0],
          totalValue: parseFloat(invoice.totalValue.toString()),
          taxableBase: parseFloat(invoice.taxableBase.toString()),
          vatTotal: parseFloat(invoice.vatTotal.toString()),
          status: invoice.status,
          accountCode: invoice.accountCode || invoice.suggestedAccount || '',
          suggestedAccount: invoice.suggestedAccount || '',
          extractionMethod: invoice.extractionMethod,
          extractionConfidence: invoice.extractionConfidence
            ? parseFloat(invoice.extractionConfidence.toString())
            : 0,
          companyName: invoice.company.name,
          lines: invoice.lines.map((line) => ({
            id: line.id,
            description: line.description,
            taxableAmount: parseFloat(line.taxableAmount.toString()),
            vatAmount: parseFloat(line.vatAmount.toString()),
            vatRateValue: parseFloat(line.vatRateValue.toString()),
            accountCode: line.accountCode || '',
          })),
        }}
      />
    </div>
  );
}
