'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Settings, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProfileData {
  isActive: boolean;
  maxCasesPerWeek: number | null;
  barNumber: string | null;
  barState: string | null;
  yearsExperience: number | null;
  jurisdictions: string[];
  specialties: string[];
}

interface ProfileEditFormProps {
  currentData: ProfileData;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

export function ProfileEditForm({ currentData }: ProfileEditFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState<ProfileData>({
    isActive: currentData.isActive,
    maxCasesPerWeek: currentData.maxCasesPerWeek,
    barNumber: currentData.barNumber,
    barState: currentData.barState,
    yearsExperience: currentData.yearsExperience,
    jurisdictions: currentData.jurisdictions || [],
    specialties: currentData.specialties || [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/arbitrator/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: formData.isActive,
          maxCasesPerWeek: formData.maxCasesPerWeek,
          barNumber: formData.barNumber || undefined,
          barState: formData.barState || undefined,
          yearsExperience: formData.yearsExperience || undefined,
          jurisdictions: formData.jurisdictions.length > 0 ? formData.jurisdictions : undefined,
          specialties: formData.specialties.length > 0 ? formData.specialties : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update profile');
      }

      toast.success('Profile updated successfully');
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJurisdictionToggle = (state: string) => {
    setFormData((prev) => ({
      ...prev,
      jurisdictions: prev.jurisdictions.includes(state)
        ? prev.jurisdictions.filter((j) => j !== state)
        : [...prev.jurisdictions, state],
    }));
  };

  if (!isEditing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Profile Settings
              </CardTitle>
              <CardDescription>
                Manage your availability and preferences
              </CardDescription>
            </div>
            <Button onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className="text-sm text-muted-foreground">Status</span>
              <p className="font-medium">{currentData.isActive ? 'Active - Accepting Cases' : 'Inactive'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Max Cases Per Week</span>
              <p className="font-medium">{currentData.maxCasesPerWeek || 'Not set'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Edit Profile
        </CardTitle>
        <CardDescription>
          Update your profile settings and preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Availability */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">Accept New Cases</Label>
              <p className="text-sm text-muted-foreground">
                When disabled, you won&apos;t be assigned new cases
              </p>
            </div>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, isActive: checked }))
              }
            />
          </div>

          {/* Max Cases Per Week */}
          <div className="space-y-2">
            <Label htmlFor="maxCasesPerWeek">Maximum Cases Per Week</Label>
            <Input
              id="maxCasesPerWeek"
              type="number"
              min="1"
              max="50"
              value={formData.maxCasesPerWeek || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  maxCasesPerWeek: e.target.value ? parseInt(e.target.value, 10) : null,
                }))
              }
              placeholder="Enter max cases per week"
            />
            <p className="text-xs text-muted-foreground">
              The maximum number of new cases to assign you per week
            </p>
          </div>

          {/* Bar Number */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="barNumber">Bar Number</Label>
              <Input
                id="barNumber"
                value={formData.barNumber || ''}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, barNumber: e.target.value }))
                }
                placeholder="Enter bar number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barState">Bar State</Label>
              <Select
                value={formData.barState || ''}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, barState: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Years Experience */}
          <div className="space-y-2">
            <Label htmlFor="yearsExperience">Years of Experience</Label>
            <Input
              id="yearsExperience"
              type="number"
              min="0"
              max="70"
              value={formData.yearsExperience || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  yearsExperience: e.target.value ? parseInt(e.target.value, 10) : null,
                }))
              }
              placeholder="Enter years of experience"
            />
          </div>

          {/* Jurisdictions */}
          <div className="space-y-2">
            <Label>Jurisdictions</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Select the states where you are authorized to arbitrate
            </p>
            <div className="grid grid-cols-6 gap-2 md:grid-cols-10">
              {US_STATES.map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => handleJurisdictionToggle(state)}
                  className={`rounded-md border p-2 text-sm font-medium transition-colors ${
                    formData.jurisdictions.includes(state)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted hover:border-muted-foreground/20'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData(currentData);
                setIsEditing(false);
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
