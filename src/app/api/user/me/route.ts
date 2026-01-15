import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api';
import { UnauthorizedError } from '@/lib/api/errors';

export async function GET() {
  try {
    const user = await getAuthUser();

    if (!user) {
      throw new UnauthorizedError('Not authenticated');
    }

    return successResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      address: user.addressStreet
        ? {
            street: user.addressStreet,
            city: user.addressCity,
            state: user.addressState,
            postalCode: user.addressPostalCode,
            country: user.addressCountry,
          }
        : null,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}
