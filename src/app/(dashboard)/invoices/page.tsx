'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Loader2, Plus, FileText, Download } from 'lucide-react';
import Link from 'next/link';

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/invoices');
      if (res.ok) setInvoices((await res.json()).data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Manage hospital billing statements and track AR history.</p>
        </div>
        
        <Link href="/invoices/builder">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
            <Plus className="mr-2 h-4 w-4" /> Generate New Invoice
          </Button>
        </Link>
      </div>

      <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>All finalized invoices previously generated for all clients.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Billing Period</TableHead>
                <TableHead className="text-right">Total Owed (BDT)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    No invoices generated yet.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id} className="border-border/50">
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.client?.name}</TableCell>
                    <TableCell>
                      {format(new Date(inv.period_start), 'dd-MMM-yyyy')} - {format(new Date(inv.period_end), 'dd-MMM-yyyy')}
                    </TableCell>
                    <TableCell className="text-right font-bold text-blue-400">
                      ৳{Number(inv.total_due).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 shadow-sm px-3">
                        <Download className="mr-2 h-3.5 w-3.5" /> PDF
                      </a>
                      <a href={`/api/invoices/${inv.id}/xlsx`} target="_blank" className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-emerald-500/50 bg-emerald-950/20 text-emerald-500 hover:bg-emerald-900/40 h-8 shadow-sm px-3">
                        <Download className="mr-2 h-3.5 w-3.5" /> Excel
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
