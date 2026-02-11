import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateEpicRequest } from '@/hooks/queries/use-epic-requests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export function NewEpicRequestPage() {
  const navigate = useNavigate();
  const createMutation = useCreateEpicRequest();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [proposedSolution, setProposedSolution] = useState('');
  const [impactAssessment, setImpactAssessment] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [successMetrics, setSuccessMetrics] = useState('');
  const [estimatedEffort, setEstimatedEffort] = useState('');

  const canSubmit = title.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const hasStructured =
      problemStatement.trim() ||
      proposedSolution.trim() ||
      impactAssessment.trim();

    try {
      const result = await createMutation.mutateAsync({
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(hasStructured
          ? {
              structuredDesc: {
                problemStatement: problemStatement.trim(),
                proposedSolution: proposedSolution.trim(),
                impactAssessment: impactAssessment.trim(),
                ...(targetAudience.trim() ? { targetAudience: targetAudience.trim() } : {}),
                ...(successMetrics.trim() ? { successMetrics: successMetrics.trim() } : {}),
                ...(estimatedEffort.trim() ? { estimatedEffort: estimatedEffort.trim() } : {}),
              },
            }
          : {}),
      });

      void navigate(`/epic-requests/${result.data.id}`);
    } catch {
      toast('Failed to create epic request. Please try again.');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => { void navigate('/epic-requests'); }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">New Epic Request</h1>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="A concise title for your request"
                value={title}
                onChange={(e) => { setTitle(e.target.value); }}
                maxLength={500}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional markdown description with additional context..."
                value={description}
                onChange={(e) => { setDescription(e.target.value); }}
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">Supports Markdown</p>
            </div>
          </CardContent>
        </Card>

        {/* Structured Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Structured Details</CardTitle>
            <p className="text-sm text-muted-foreground">
              Optional but recommended — helps reviewers evaluate your request
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="problemStatement">Problem Statement</Label>
              <Textarea
                id="problemStatement"
                placeholder="What problem or opportunity does this address?"
                value={problemStatement}
                onChange={(e) => { setProblemStatement(e.target.value); }}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposedSolution">Proposed Solution</Label>
              <Textarea
                id="proposedSolution"
                placeholder="How would you solve this at a high level?"
                value={proposedSolution}
                onChange={(e) => { setProposedSolution(e.target.value); }}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="impactAssessment">Impact Assessment</Label>
              <Textarea
                id="impactAssessment"
                placeholder="What impact and benefits are expected?"
                value={impactAssessment}
                onChange={(e) => { setImpactAssessment(e.target.value); }}
                className="min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetAudience">Target Audience</Label>
                <Input
                  id="targetAudience"
                  placeholder="Who benefits from this?"
                  value={targetAudience}
                  onChange={(e) => { setTargetAudience(e.target.value); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedEffort">Estimated Effort</Label>
                <Input
                  id="estimatedEffort"
                  placeholder="e.g., 2-3 weeks"
                  value={estimatedEffort}
                  onChange={(e) => { setEstimatedEffort(e.target.value); }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="successMetrics">Success Metrics</Label>
              <Input
                id="successMetrics"
                placeholder="How will success be measured?"
                value={successMetrics}
                onChange={(e) => { setSuccessMetrics(e.target.value); }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => { void navigate('/epic-requests'); }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => { void handleSubmit(); }}
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </div>
    </div>
  );
}
