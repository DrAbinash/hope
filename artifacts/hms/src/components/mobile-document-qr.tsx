import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, QrCode } from "lucide-react";
import { generateQRCode } from "@/lib/document-utils";

interface MobileDocumentQRProps {
  patientId: number | string;
  category: string;
  onClose?: () => void;
}

export function MobileDocumentQR({ patientId, category, onClose }: MobileDocumentQRProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [sessionId] = useState(() => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const generateQR = async () => {
      const url = `${window.location.origin}/mobile/document-upload?patientId=${patientId}&category=${encodeURIComponent(category)}&session=${sessionId}`;
      const qr = await generateQRCode(url, 512);
      setQrCode(qr);
    };
    generateQR();
  }, [patientId, category, sessionId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              Mobile Upload
            </span>
            {onClose && (
              <Button size="icon" variant="ghost" onClick={onClose} className="h-6 w-6">
                <X className="w-4 h-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Scan this QR code with your phone camera to upload {category.toLowerCase()} directly from your mobile device.
          </p>

          {qrCode ? (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-2 rounded-lg border">
                <img src={qrCode} alt="Upload QR Code" className="w-48 h-48" />
              </div>
              <Badge variant="secondary" className="text-xs">
                Session: {sessionId.substring(0, 8)}
              </Badge>
              <p className="text-xs text-muted-foreground text-center">
                This link expires after upload or when closed.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          <Button onClick={onClose} variant="outline" className="w-full h-8 text-xs">
            Close
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
