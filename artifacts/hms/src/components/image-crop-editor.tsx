import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Crop, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";

interface ImageCropEditorProps {
  imageUrl: string;
  onSave: (croppedBlob: Blob) => void;
  onCancel: () => void;
  title?: string;
}

export function ImageCropEditor({ imageUrl, onSave, onCancel, title = "Crop Image" }: ImageCropEditorProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 300, height: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      if (imgRef.current) {
        imgRef.current.src = imageUrl;
        setCropBox({
          x: 20,
          y: 20,
          width: Math.min(img.width - 40, 400),
          height: Math.min(img.height - 40, 400),
        });
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    const deltaX = currentX - dragStart.x;
    const deltaY = currentY - dragStart.y;

    setCropBox((prev) => ({
      ...prev,
      x: Math.max(0, prev.x + deltaX),
      y: Math.max(0, prev.y + deltaY),
    }));

    setDragStart({ x: currentX, y: currentY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSave = async () => {
    if (!canvasRef.current || !imgRef.current) return;

    try {
      setIsSaving(true);
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas context");

      const img = imgRef.current;
      const displayWidth = img.offsetWidth;
      const displayHeight = img.offsetHeight;
      const scaleX = img.naturalWidth / displayWidth;
      const scaleY = img.naturalHeight / displayHeight;

      canvasRef.current.width = cropBox.width * scaleX;
      canvasRef.current.height = cropBox.height * scaleY;

      ctx.save();
      ctx.translate(canvasRef.current.width / 2, canvasRef.current.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(
        img,
        (cropBox.x * scaleX - canvasRef.current.width / 2),
        (cropBox.y * scaleY - canvasRef.current.height / 2),
        img.naturalWidth,
        img.naturalHeight
      );
      ctx.restore();

      canvasRef.current.toBlob((blob) => {
        if (!blob) throw new Error("Failed to create blob");
        onSave(blob);
        toast.success("Image cropped successfully");
      }, "image/jpeg", 0.9);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to crop image");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-4xl w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Crop className="w-4 h-4" />
              {title}
            </span>
            <Button size="icon" variant="ghost" onClick={onCancel} className="h-6 w-6">
              <X className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          {/* Image with crop box */}
          <div
            ref={containerRef}
            className="relative bg-black rounded-lg overflow-auto max-h-96 cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop"
              className="w-full"
              style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
            />

            {/* Crop box overlay */}
            <div
              className="absolute border-2 border-yellow-400 bg-yellow-400/10"
              style={{
                left: `${cropBox.x}px`,
                top: `${cropBox.y}px`,
                width: `${cropBox.width}px`,
                height: `${cropBox.height}px`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-xs text-yellow-400 font-semibold opacity-50">
                {Math.round(cropBox.width)} × {Math.round(cropBox.height)}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Scale</Label>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex-1"
                  onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                >
                  <ZoomOut className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex-1"
                  onClick={() => setScale(Math.min(3, scale + 0.1))}
                >
                  <ZoomIn className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Rotate</Label>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs w-full"
                onClick={() => setRotation((r) => (r + 90) % 360)}
              >
                <RotateCw className="w-3 h-3 mr-1" />
                {rotation}°
              </Button>
            </div>

            <div>
              <Label className="text-xs">Width</Label>
              <Input
                type="number"
                value={Math.round(cropBox.width)}
                onChange={(e) => setCropBox({ ...cropBox, width: Number(e.target.value) })}
                className="h-7 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Height</Label>
              <Input
                type="number"
                value={Math.round(cropBox.height)}
                onChange={(e) => setCropBox({ ...cropBox, height: Number(e.target.value) })}
                className="h-7 text-xs"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button onClick={onCancel} variant="outline" className="h-8 text-xs flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="h-8 text-xs flex-1">
              {isSaving ? "Cropping..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
