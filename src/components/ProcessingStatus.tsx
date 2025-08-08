import React from 'react';
import { CheckCircle2, AlertCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { JobStatus } from '@/services/api';

interface ProcessingStatusProps {
  jobs: JobStatus[];
  overall: string;
  onRetry?: (fileType: string) => void;
  onContinueToAnalysis?: () => void;
}

export function ProcessingStatus({ jobs, overall, onRetry, onContinueToAnalysis }: ProcessingStatusProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'done':
        return 'default';
      case 'running':
        return 'secondary';
      case 'queued':
        return 'outline';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getOverallProgress = () => {
    if (jobs.length === 0) return 0;
    const totalProgress = jobs.reduce((sum, job) => {
      if (job.status === 'done') return sum + 100;
      if (job.status === 'running') return sum + job.progress;
      return sum;
    }, 0);
    return totalProgress / jobs.length;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {overall === 'done' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : overall === 'failed' ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : (
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            )}
            Processing Status
          </CardTitle>
          <CardDescription>
            {overall === 'done' 
              ? 'All files have been processed successfully'
              : overall === 'failed'
              ? 'Some files failed to process'
              : 'Your files are being transformed and validated'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{Math.round(getOverallProgress())}%</span>
              </div>
              <Progress value={getOverallProgress()} className="w-full" />
            </div>

            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.file_type} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <Badge variant={job.file_type === 'policy' ? 'default' : job.file_type === 'claim' ? 'secondary' : 'outline'}>
                      {job.file_type}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(job.status)}>
                          {job.status}
                        </Badge>
                        {job.status === 'running' && (
                          <span className="text-sm text-muted-foreground">
                            {Math.round(job.progress * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {job.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last updated: {new Date(job.updated_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  {job.status === 'failed' && onRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry(job.file_type)}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {overall === 'done' && onContinueToAnalysis && (
              <div className="pt-4 border-t">
                <Button onClick={onContinueToAnalysis} className="w-full">
                  Continue to Analysis
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}