import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface UploadedFile {
  id: string;
  name: string;
  type: 'policy' | 'claim' | 'cancel';
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface FileUploadZoneProps {
  uploadedFiles: UploadedFile[];
  onFileUpload: (files: FileList, fileType: 'policy' | 'claim' | 'cancel') => void;
}

interface DropZoneProps {
  fileType: 'policy' | 'claim' | 'cancel';
  title: string;
  description: string;
  required: boolean;
  onFileUpload: (files: FileList, fileType: 'policy' | 'claim' | 'cancel') => void;
  hasFile: boolean;
}

function DropZone({ fileType, title, description, required, onFileUpload, hasFile }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileUpload(files, fileType);
    }
  }, [fileType, onFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileUpload(files, fileType);
    }
    // Reset input value to allow re-uploading the same file
    e.target.value = '';
  }, [fileType, onFileUpload]);

  const getBorderColor = () => {
    if (hasFile) return 'border-success bg-success/5';
    if (isDragOver) return 'border-primary bg-primary/5';
    if (required) return 'border-dashed border-border';
    return 'border-dashed border-muted';
  };

  const getFileTypeColor = () => {
    switch (fileType) {
      case 'policy': return 'bg-primary text-primary-foreground';
      case 'claim': return 'bg-secondary text-secondary-foreground';
      case 'cancel': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card 
      className={`relative transition-all duration-200 ${getBorderColor()}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className={`p-3 rounded-full ${hasFile ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
              {hasFile ? <FileText className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <h3 className="font-semibold">{title}</h3>
              <Badge className={getFileTypeColor()}>
                {fileType}
              </Badge>
              {required && <Badge variant="destructive" className="text-xs">Required</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {hasFile ? (
            <div className="flex items-center justify-center gap-2 text-success">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">File uploaded successfully</span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Drag and drop your file here, or click to browse
              </p>
              
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id={`file-input-${fileType}`}
              />
              <label htmlFor={`file-input-${fileType}`}>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="cursor-pointer"
                  asChild
                >
                  <span>Choose File</span>
                </Button>
              </label>
              
              <p className="text-xs text-muted-foreground">
                Supported formats: CSV, Excel (.xlsx, .xls)
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function FileUploadZone({ uploadedFiles, onFileUpload }: FileUploadZoneProps) {
  const hasFileOfType = (type: 'policy' | 'claim' | 'cancel') => {
    return uploadedFiles.some(file => file.type === type);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Upload Your Files</h2>
        <p className="text-muted-foreground">
          Upload your policy and claim files. Cancel file is optional.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DropZone
          fileType="policy"
          title="Policy File"
          description="Contract and coverage information"
          required={true}
          onFileUpload={onFileUpload}
          hasFile={hasFileOfType('policy')}
        />
        
        <DropZone
          fileType="claim"
          title="Claim File" 
          description="Loss and settlement data"
          required={true}
          onFileUpload={onFileUpload}
          hasFile={hasFileOfType('claim')}
        />
        
        <DropZone
          fileType="cancel"
          title="Cancel File"
          description="Cancellation and refund data"
          required={false}
          onFileUpload={onFileUpload}
          hasFile={hasFileOfType('cancel')}
        />
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold text-amber-900">Upload Guidelines</h3>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Maximum file size: 50MB per file</li>
                <li>• Files will be automatically processed and validated</li>
                <li>• Field detection will suggest mapping for your columns</li>
                <li>• You can replace files by uploading again</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}