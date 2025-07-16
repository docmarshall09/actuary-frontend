import React, { useState, useEffect } from 'react';
import { X, FileText, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface FilePreviewModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FilePreviewModal({ file, isOpen, onClose }: FilePreviewModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !isOpen) {
      setPreview(null);
      setError(null);
      return;
    }

    const loadPreview = async () => {
      setLoading(true);
      setError(null);

      try {
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        if (extension === '.csv') {
          const text = await file.text();
          const lines = text.split('\n').slice(0, 20); // Show first 20 lines
          const tableRows = lines.map(line => line.split(','));
          
          setPreview(`
            <table class="w-full border-collapse">
              <thead>
                <tr class="border-b">
                  ${tableRows[0]?.map(cell => `<th class="text-left p-2 font-medium">${cell.trim()}</th>`).join('') || ''}
                </tr>
              </thead>
              <tbody>
                ${tableRows.slice(1).map(row => 
                  `<tr class="border-b border-border/50">
                    ${row.map(cell => `<td class="p-2 text-sm">${cell.trim()}</td>`).join('')}
                  </tr>`
                ).join('')}
              </tbody>
            </table>
            ${lines.length >= 20 ? '<p class="text-sm text-muted-foreground mt-4">... and more rows</p>' : ''}
          `);
        } else if (['.xlsx', '.xls'].includes(extension)) {
          setPreview(`
            <div class="text-center py-8 space-y-4">
              <FileText class="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 class="font-medium">Excel File Preview</h3>
                <p class="text-sm text-muted-foreground">
                  Excel files cannot be previewed directly. The file will be processed during upload.
                </p>
              </div>
            </div>
          `);
        } else {
          setError('File type not supported for preview');
        }
      } catch (err) {
        setError('Failed to load file preview');
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [file, isOpen]);

  const handleDownload = () => {
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5" />
              <span>{file.name}</span>
              <Badge variant="outline" className="text-xs">
                {(file.size / 1024).toFixed(1)} KB
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            {loading && (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              </div>
            )}
            
            {error && (
              <div className="text-center py-8">
                <p className="text-destructive">{error}</p>
              </div>
            )}
            
            {preview && !loading && !error && (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}