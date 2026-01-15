import { redirect } from 'next/navigation';

import { UserRole } from '@prisma/client';
import { format } from 'date-fns';
import {
  User,
  Scale,
  Award,
  Clock,
  CheckCircle,
  MapPin,
  Briefcase,
  Calendar,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

import { ProfileEditForm } from './profile-edit-form';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Arbitrator Profile',
  description: 'View and manage your arbitrator profile',
};

async function getArbitratorProfile(userId: string) {
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      },
    },
  });

  if (!profile) return null;

  // Get assignment stats
  const [completedReviews, pendingReviews, issuedAwards] = await Promise.all([
    prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: { not: null },
      },
    }),
    prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: null,
      },
    }),
    prisma.award.count({
      where: { arbitratorId: userId },
    }),
  ]);

  return {
    ...profile,
    stats: {
      completedReviews,
      pendingReviews,
      issuedAwards,
    },
  };
}

export default async function ArbitratorProfilePage() {
  const user = await getAuthUser();
  if (!user) return redirect('/sign-in');

  // Ensure user is an arbitrator
  if (user.role !== UserRole.ARBITRATOR && user.role !== UserRole.ADMIN) {
    return redirect('/dashboard');
  }

  const profile = await getArbitratorProfile(user.id);

  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Arbitrator Profile</h1>
          <p className="text-muted-foreground">
            Your arbitrator profile has not been set up yet.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Not Found</CardTitle>
            <CardDescription>
              Please contact an administrator to set up your arbitrator profile.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Arbitrator Profile</h1>
        <p className="text-muted-foreground">
          View and manage your profile settings
        </p>
      </div>

      {/* Profile Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{profile.user.name}</CardTitle>
                <CardDescription>{profile.user.email}</CardDescription>
              </div>
            </div>
            <Badge variant={profile.isActive ? 'default' : 'secondary'}>
              {profile.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-sm text-muted-foreground">Member Since</span>
                <p className="font-medium">
                  {format(new Date(profile.user.createdAt), 'MMMM yyyy')}
                </p>
              </div>
            </div>
            {profile.barNumber && (
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm text-muted-foreground">Bar Number</span>
                  <p className="font-medium">
                    {profile.barNumber} ({profile.barState})
                  </p>
                </div>
              </div>
            )}
            {profile.yearsExperience && (
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm text-muted-foreground">Experience</span>
                  <p className="font-medium">{profile.yearsExperience} years</p>
                </div>
              </div>
            )}
            {profile.isRetiredJudge && (
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm text-muted-foreground">Status</span>
                  <p className="font-medium">Retired Judge</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.stats.pendingReviews}</div>
            <p className="text-xs text-muted-foreground">Cases awaiting your review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reviews Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.stats.completedReviews}</div>
            <p className="text-xs text-muted-foreground">Total completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awards Issued</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.stats.issuedAwards}</div>
            <p className="text-xs text-muted-foreground">Finalized decisions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Review Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profile.avgReviewTime ? `${profile.avgReviewTime} min` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Average per case</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Jurisdictions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Jurisdictions
            </CardTitle>
            <CardDescription>
              States and regions where you are authorized to arbitrate
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile.jurisdictions && profile.jurisdictions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.jurisdictions.map((jurisdiction: string) => (
                  <Badge key={jurisdiction} variant="outline">
                    {jurisdiction}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No jurisdictions specified</p>
            )}
          </CardContent>
        </Card>

        {/* Specialties */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Specialties
            </CardTitle>
            <CardDescription>
              Types of disputes you specialize in
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile.specialties && profile.specialties.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.specialties.map((specialty: string) => (
                  <Badge key={specialty} variant="secondary">
                    {specialty}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No specialties specified</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile */}
      <ProfileEditForm
        currentData={{
          isActive: profile.isActive,
          maxCasesPerWeek: profile.maxCasesPerWeek,
          barNumber: profile.barNumber,
          barState: profile.barState,
          yearsExperience: profile.yearsExperience,
          jurisdictions: profile.jurisdictions,
          specialties: profile.specialties as string[],
        }}
      />
    </div>
  );
}
