import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PreUploadChecklist } from './PreUploadChecklist';
import { FileUploadZone } from './FileUploadZone';
import { SimpleMappingWizard } from './SimpleMappingWizard';
import { FilePreviewModal } from './FilePreviewModal';
import { useToast } from '@/hooks/use-toast';
import { apiService, StatusResponse, JobStatus } from '@/services/api';
import { ProcessingStatus } from './ProcessingStatus';

type UploadStep = 'checklist' | 'upload' | 'mapping' | 'processing' | 'complete';

interface UploadedFile {
  id: string;
  name: string;
  type: 'policy' | 'claim' | 'cancel';
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  mappingSuggestions?: MappingSuggestion[];
}

interface MappingSuggestion {
  source_field: string;
  suggested_canonical: string;
  populated_pct: number;
  detected_type: string;
  confidence: number;
}

export function UploadWizard() {
  const [currentStep, setCurrentStep] = useState<UploadStep>('checklist');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [jobStatuses, setJobStatuses] = useState<JobStatus[]>([]);
  const [overallStatus, setOverallStatus] = useState<string>('pending');
  const { toast } = useToast();

  const getStepProgress = () => {
    const steps = ['checklist', 'upload', 'mapping', 'processing', 'complete'];
    return ((steps.indexOf(currentStep) + 1) / steps.length) * 100;
  };

  const startStatusPolling = useCallback(async (uploadId: string) => {
    try {
      await apiService.pollStatus(uploadId, (status: StatusResponse) => {
        setJobStatuses(status.jobs);
        setOverallStatus(status.overall);
        
        if (status.overall === 'done') {
          setCurrentStep('complete');
          toast({
            title: "Processing Complete",
            description: "All files have been processed successfully!",
          });
        } else if (status.overall === 'failed') {
          toast({
            title: "Processing Failed",
            description: "Some files failed to process. Please check the details below.",
            variant: "destructive"
          });
        }
      });
    } catch (error) {
      console.error('Status polling error:', error);
      toast({
        title: "Status Check Failed",
        description: "Unable to check processing status. Please refresh the page.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const handleFileUpload = useCallback(async (files: FileList, fileType: 'policy' | 'claim' | 'cancel') => {
    const file = files[0];
    if (!file) return;

    // Validate file type
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: "Invalid file type",
        description: "Please upload CSV or Excel files only.",
        variant: "destructive"
      });
      return;
    }

    const newFile: UploadedFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: fileType,
      file,
      status: 'pending'
    };

    setUploadedFiles(prev => {
      // Remove any existing file of the same type
      const filtered = prev.filter(f => f.type !== fileType);
      return [...filtered, newFile];
    });

    try {
      // Upload file if we don't have an upload_id yet, or if this is the first file
      if (!uploadId) {
        setUploadedFiles(prev => 
          prev.map(f => f.id === newFile.id ? { ...f, status: 'processing' } : f)
        );

        const uploadFiles: { [key: string]: File } = {};
        uploadFiles[fileType] = file;
        
        const response = await apiService.uploadFiles(uploadFiles);
        setUploadId(response.upload_id);

        // Get field detection for this file
        const detections = await apiService.detectFields(response.upload_id, fileType);
        
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === newFile.id 
              ? { 
                  ...f, 
                  status: 'completed',
                  mappingSuggestions: detections
                }
              : f
          )
        );
      } else {
        // For subsequent files, upload individually
        setUploadedFiles(prev => 
          prev.map(f => f.id === newFile.id ? { ...f, status: 'processing' } : f)
        );

        const uploadFiles: { [key: string]: File } = {};
        uploadFiles[fileType] = file;
        
        const response = await apiService.uploadFiles(uploadFiles);
        
        // Get field detection for this file
        const detections = await apiService.detectFields(response.upload_id, fileType);
        
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === newFile.id 
              ? { 
                  ...f, 
                  status: 'completed',
                  mappingSuggestions: detections
                }
              : f
          )
        );
      }

      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been processed and is ready for mapping.`,
      });

    } catch (error) {
      console.error('Upload error:', error);
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === newFile.id 
            ? { ...f, status: 'error' }
            : f
        )
      );
      
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload.",
        variant: "destructive"
      });
    }
  }, [toast, uploadId]);

  const generateMockSuggestions = (fileType: string): MappingSuggestion[] => {
    // Mock field detection suggestions based on file type
    const suggestions: Record<string, MappingSuggestion[]> = {
      policy: [
        { source_field: 'PolicyNo', suggested_canonical: 'policy_number', populated_pct: 99.8, detected_type: 'string', confidence: 0.95 },
        { source_field: 'StartDate', suggested_canonical: 'effective_date', populated_pct: 100, detected_type: 'date', confidence: 0.92 },
        { source_field: 'EndDate', suggested_canonical: 'expiration_date', populated_pct: 100, detected_type: 'date', confidence: 0.92 },
        { source_field: 'Premium', suggested_canonical: 'premium_written', populated_pct: 98.5, detected_type: 'decimal', confidence: 0.88 },
        { source_field: 'ProductType', suggested_canonical: 'product_type', populated_pct: 95.2, detected_type: 'string', confidence: 0.90 },
        { source_field: 'Coverage', suggested_canonical: 'coverage_code', populated_pct: 87.3, detected_type: 'string', confidence: 0.85 }
      ],
      claim: [
        { source_field: 'ClaimID', suggested_canonical: 'claim_number', populated_pct: 100, detected_type: 'string', confidence: 0.98 },
        { source_field: 'PolicyNumber', suggested_canonical: 'policy_number', populated_pct: 100, detected_type: 'string', confidence: 0.95 },
        { source_field: 'ReportedDate', suggested_canonical: 'report_date', populated_pct: 99.1, detected_type: 'date', confidence: 0.90 },
        { source_field: 'SettlementDate', suggested_canonical: 'paid_date', populated_pct: 78.5, detected_type: 'date', confidence: 0.85 },
        { source_field: 'Amount', suggested_canonical: 'paid_amount', populated_pct: 89.2, detected_type: 'decimal', confidence: 0.92 }
      ],
      cancel: [
        { source_field: 'PolicyNo', suggested_canonical: 'policy_number', populated_pct: 100, detected_type: 'string', confidence: 0.95 },
        { source_field: 'CancelDate', suggested_canonical: 'cancel_date', populated_pct: 100, detected_type: 'date', confidence: 0.93 },
        { source_field: 'RefundAmount', suggested_canonical: 'refund_premium', populated_pct: 92.3, detected_type: 'decimal', confidence: 0.88 }
      ]
    };

    return suggestions[fileType] || [];
  };

  const canProceedToMapping = () => {
    // Only require policy file now (claim/cancel optional)
    const hasPolicy = uploadedFiles.some(f => f.type === 'policy' && f.status === 'completed');
    return hasPolicy;
  };

  const handleProceedToMapping = () => {
    if (!canProceedToMapping()) {
      toast({
        title: "Missing required files",
        description: "Please upload at least a policy file before proceeding.",
        variant: "destructive"
      });
      return;
    }
    setCurrentStep('mapping');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'checklist':
        return (
          <div className="space-y-6">
            <PreUploadChecklist />
            <div className="flex justify-end">
              <Button 
                variant="professional" 
                onClick={() => setCurrentStep('upload')}
                className="gap-2"
              >
                Continue to Upload
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case 'upload':
        return (
          <div className="space-y-6">
            <FileUploadZone 
              uploadedFiles={uploadedFiles}
              onFileUpload={handleFileUpload}
            />
            
            {uploadedFiles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Uploaded Files
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Badge variant={file.type === 'policy' ? 'default' : file.type === 'claim' ? 'secondary' : 'outline'}>
                            {file.type}
                          </Badge>
                          <span 
                            className="font-medium cursor-pointer hover:text-primary transition-colors"
                            onDoubleClick={() => {
                              setPreviewFile(file.file);
                              setPreviewOpen(true);
                            }}
                          >
                            {file.name}
                          </span>
                          <span className="text-xs text-muted-foreground">Double-click to preview</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPreviewFile(file.file);
                              setPreviewOpen(true);
                            }}
                            className="gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            Preview
                          </Button>
                          <div className="flex items-center gap-2">
                            {file.status === 'pending' && <AlertTriangle className="h-4 w-4 text-warning" />}
                            {file.status === 'processing' && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                            {file.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-success" />}
                            {file.status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('checklist')}>
                Back to Checklist
              </Button>
              <Button 
                variant="professional" 
                onClick={handleProceedToMapping}
                disabled={!canProceedToMapping()}
                className="gap-2"
              >
                Proceed to Mapping
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case 'mapping':
        return (
          <div className="space-y-6">
            <SimpleMappingWizard 
              uploadedFiles={uploadedFiles}
              uploadId={uploadId}
              onComplete={(mappings) => {
                console.log('Mappings completed:', mappings);
                setCurrentStep('processing');
                toast({
                  title: "Mappings Saved",
                  description: "Transform started. Please wait while files are processed...",
                });
                if (uploadId) {
                  startStatusPolling(uploadId);
                }
              }}
              onBack={() => setCurrentStep('upload')}
            />
          </div>
        );

      case 'processing':
        return (
          <ProcessingStatus
            jobs={jobStatuses}
            overall={overallStatus}
            onRetry={(fileType) => {
              toast({
                title: "Retry Not Implemented",
                description: "Retry functionality will be available in a future update.",
                variant: "destructive"
              });
            }}
          />
        );

      case 'complete':
        return (
          <ProcessingStatus
            jobs={jobStatuses}
            overall={overallStatus}
            onContinueToAnalysis={() => {
              toast({
                title: "Analysis Coming Soon",
                description: "Analysis features will be available in Phase 3.",
              });
            }}
          />
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'checklist': return 'Pre-Upload Checklist';
      case 'upload': return 'Upload Files';
      case 'mapping': return 'Field Mapping';
      case 'processing': return 'Processing';
      case 'complete': return 'Complete';
      default: return 'Upload Wizard';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Actuary in a Box</h1>
        <p className="text-lg text-muted-foreground">Upload & Mapping Wizard</p>
        
        {/* Progress Indicator */}
        <div className="max-w-md mx-auto space-y-2">
          <Progress value={getStepProgress()} className="w-full" />
          <p className="text-sm text-muted-foreground">
            Step {['checklist', 'upload', 'mapping', 'processing', 'complete'].indexOf(currentStep) + 1} of 5: {getStepTitle()}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">{getStepTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* File Preview Modal */}
      <FilePreviewModal 
        file={previewFile}
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewFile(null);
        }}
      />
    </div>
  );
}