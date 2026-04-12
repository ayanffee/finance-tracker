import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, Loader2, Check, AlertCircle, X } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

interface ParsedRow {
  amount: string;
  type: "income" | "expense";
  date: string;
  description: string;
  categoryId: number;
  categoryName: string;
  rowIndex: number;
}

interface CsvUploadProps {
  categories: { id: number; name: string; type: string }[];
  onImported: () => void;
}

export default function CsvUpload({ categories, onImported }: CsvUploadProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseStats, setParseStats] = useState({ totalRows: 0, parsedRows: 0, skippedRows: 0 });
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseMutation = trpc.transactions.parseCsv.useMutation();
  const importMutation = trpc.transactions.importCsv.useMutation();

  const expenseCategories = categories.filter(c => c.type === "expense");
  const incomeCategories = categories.filter(c => c.type === "income");

  const reset = () => {
    setStep("upload");
    setParsedRows([]);
    setParseStats({ totalRows: 0, parsedRows: 0, skippedRows: 0 });
    setSelectedRows(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv") && !file.name.endsWith(".tsv") && !file.name.endsWith(".txt")) {
      toast.error("Please upload a CSV or TSV file");
      return;
    }

    try {
      const text = await file.text();
      const result = await parseMutation.mutateAsync({ csvText: text });
      setParsedRows(result.rows);
      setParseStats({ totalRows: result.totalRows, parsedRows: result.parsedRows, skippedRows: result.skippedRows });
      setSelectedRows(new Set(result.rows.map((_: ParsedRow, i: number) => i)));
      setStep("preview");
    } catch (err: any) {
      toast.error(err?.message || "Failed to parse CSV");
    }
  };

  const toggleRow = (idx: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === parsedRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(parsedRows.map((_, i) => i)));
    }
  };

  const updateRowCategory = (rowIdx: number, categoryId: number) => {
    setParsedRows(prev => prev.map((row, i) => {
      if (i !== rowIdx) return row;
      const cat = categories.find(c => c.id === categoryId);
      return { ...row, categoryId, categoryName: cat?.name ?? "Unknown" };
    }));
  };

  const updateRowType = (rowIdx: number, type: "income" | "expense") => {
    setParsedRows(prev => prev.map((row, i) => {
      if (i !== rowIdx) return row;
      const relevantCats = type === "income" ? incomeCategories : expenseCategories;
      const defaultCat = relevantCats[0];
      return { ...row, type, categoryId: defaultCat?.id ?? 0, categoryName: defaultCat?.name ?? "Unknown" };
    }));
  };

  const handleImport = async () => {
    const rowsToImport = parsedRows.filter((_, i) => selectedRows.has(i));
    if (rowsToImport.length === 0) {
      toast.error("No rows selected");
      return;
    }

    setStep("importing");
    try {
      const result = await importMutation.mutateAsync({
        rows: rowsToImport.map(r => ({
          categoryId: r.categoryId,
          type: r.type,
          amount: r.amount,
          date: new Date(r.date),
          description: r.description || undefined,
        })),
      });
      toast.success(`Imported ${result.imported} of ${result.total} transactions`);
      onImported();
      setOpen(false);
      reset();
    } catch {
      toast.error("Failed to import transactions");
      setStep("preview");
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); setOpen(v); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file from your bank or accounting tool
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Drop a CSV file here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports most bank export formats (Date, Amount, Description columns)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={parseMutation.isPending}
            >
              {parseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </>
              )}
            </Button>
          </div>
        )}

        {step === "preview" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Stats */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary">
                <Check className="h-3 w-3 mr-1" />
                {parseStats.parsedRows} parsed
              </Badge>
              {parseStats.skippedRows > 0 && (
                <Badge variant="outline" className="text-orange-600">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {parseStats.skippedRows} skipped (no valid amount)
                </Badge>
              )}
              <Badge variant="outline">
                {selectedRows.size} selected for import
              </Badge>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === parsedRows.length}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => {
                    const relevantCats = row.type === "income" ? incomeCategories : expenseCategories;
                    return (
                      <tr
                        key={idx}
                        className={`border-t hover:bg-muted/30 ${!selectedRows.has(idx) ? "opacity-40" : ""}`}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(idx)}
                            onChange={() => toggleRow(idx)}
                            className="rounded"
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {new Date(row.date).toLocaleDateString()}
                        </td>
                        <td className="p-2 max-w-[200px] truncate" title={row.description}>
                          {row.description}
                        </td>
                        <td className={`p-2 text-right font-medium ${row.type === "income" ? "text-green-600" : "text-red-600"}`}>
                          {row.type === "income" ? "+" : "-"}${row.amount}
                        </td>
                        <td className="p-2">
                          <Select
                            value={row.type}
                            onValueChange={v => updateRowType(idx, v as "income" | "expense")}
                          >
                            <SelectTrigger className="h-7 text-xs w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="income">Income</SelectItem>
                              <SelectItem value="expense">Expense</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select
                            value={row.categoryId.toString()}
                            onValueChange={v => updateRowCategory(idx, parseInt(v))}
                          >
                            <SelectTrigger className="h-7 text-xs w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {relevantCats.map(cat => (
                                <SelectItem key={cat.id} value={cat.id.toString()}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" onClick={reset}>
                <X className="h-4 w-4 mr-2" />
                Start Over
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedRows.size === 0 || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Import {selectedRows.size} Transactions
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Importing transactions...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
