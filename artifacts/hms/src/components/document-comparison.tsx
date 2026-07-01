import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Document {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy?: string;
}

interface DocumentComparisonProps {
  doc1: Document;
  doc2: Document;
  onClose: () => void;
  title?: string;
}

export function DocumentComparison({ doc1, doc2, onClose, title = "Compare Documents" }: DocumentComparisonProps) {
  const [scale, setScale] = useState(1);
  const [activeDoc, setActiveDoc] = useState<1 | 2>(1);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-6xl w-full h-[90vh]">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-6 w-6">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-2 pt-2 h-full overflow-hidden flex flex-col">
          {/* Controls */}
          <div className="flex items-center justify-between bg-muted p-2 rounded gap-2">
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setScale(Math.max(0.5, scale - 0.1))}>
                <ZoomOut className="w-3 h-3" />
              </Button>
              <span className="px-2 text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setScale(Math.min(3, scale + 0.1))}>
                <ZoomIn className="w-3 h-3" />
              </Button>
            </div>

            <div className="flex gap-1">
              <Button
                size="sm"
                variant={activeDoc === 1 ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setActiveDoc(1)}
              >
                <ChevronLeft className="w-3 h-3 mr-1" />
                {doc1.name}
              </Button>
              <Button
                size="sm"
                variant={activeDoc === 2 ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setActiveDoc(2)}
              >
                {doc2.name}
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>

          {/* Two-column comparison */}
          <div className="grid grid-cols-2 gap-2 flex-1 overflow-hidden">
            {/* Document 1 */}
            <div className="border rounded-lg overflow-auto bg-black/5">
              <div className="sticky top-0 bg-muted p-2 border-b z-10 text-xs">
                <p className="font-semibold truncate">{doc1.name}</p>
                <p className="text-muted-foreground">{new Date(doc1.uploadedAt).toLocaleString()}</p>
                {doc1.uploadedBy && <p className="text-muted-foreground">by {doc1.uploadedBy}</p>}
              </div>
              <div className="p-2 flex items-center justify-center" style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
                {doc1.url.endsWith(".pdf") || doc1.url.includes("pdf") ? (
                  <iframe src={doc1.url} className="w-full h-full border rounded" title="Document 1" />
                ) : (
                  <img src={doc1.url} alt={doc1.name} className="max-w-full max-h-full rounded" />
                )}
              </div>
            </div>

            {/* Document 2 */}
            <div className="border rounded-lg overflow-auto bg-black/5">
              <div className="sticky top-0 bg-muted p-2 border-b z-10 text-xs">
                <p className="font-semibold truncate">{doc2.name}</p>
                <p className="text-muted-foreground">{new Date(doc2.uploadedAt).toLocaleString()}</p>
                {doc2.uploadedBy && <p className="text-muted-foreground">by {doc2.uploadedBy}</p>}
              </div>
              <div className="p-2 flex items-center justify-center" style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
                {doc2.url.endsWith(".pdf") || doc2.url.includes("pdf") ? (
                  <iframe src={doc2.url} className="w-full h-full border rounded" title="Document 2" />
                ) : (
                  <img src={doc2.url} alt={doc2.name} className="max-w-full max-h-full rounded" />
                )}
              </div>
            </div>
          </div>

          {/* Mobile view toggle */}
          {activeDoc === 1 ? (
            <div className="md:hidden border rounded-lg overflow-auto bg-black/5 h-64">
              <div className="bg-muted p-2 border-b text-xs">
                <p className="font-semibold truncate">{doc1.name}</p>
              </div>
              <div className="p-2 flex items-center justify-center" style={{ transform: `scale(${scale})` }}>
                {doc1.url.endsWith(".pdf") ? (
                  <iframe src={doc1.url} className="w-full h-full border rounded" title="Document 1" />
                ) : (
                  <img src={doc1.url} alt={doc1.name} className="max-w-full max-h-full rounded" />
                )}
              </div>
            </div>
          ) : (
            <div className="md:hidden border rounded-lg overflow-auto bg-black/5 h-64">
              <div className="bg-muted p-2 border-b text-xs">
                <p className="font-semibold truncate">{doc2.name}</p>
              </div>
              <div className="p-2 flex items-center justify-center" style={{ transform: `scale(${scale})` }}>
                {doc2.url.endsWith(".pdf") ? (
                  <iframe src={doc2.url} className="w-full h-full border rounded" title="Document 2" />
                ) : (
                  <img src={doc2.url} alt={doc2.name} className="max-w-full max-h-full rounded" />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
