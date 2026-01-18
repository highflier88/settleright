import { z } from 'zod';

import { errorResponse, successResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { addAdminNote } from '@/lib/services/kyc-admin';
import { validateBody } from '@/lib/validations';

const addNoteSchema = z.object({
  note: z.string().min(1, 'Note is required').max(5000, 'Note is too long'),
});

async function handlePost(
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) {
  const id = context?.params?.id;
  if (!id) {
    return errorResponse('Verification ID is required', 400);
  }
  const body = await request.json();
  const data = validateBody(addNoteSchema, body);

  const result = await addAdminNote(id, request.user.id, data.note);

  if (!result.success) {
    return errorResponse(result.error ?? 'Failed to add note', 400);
  }

  return successResponse({ message: 'Note added successfully' }, 201);
}

export const POST = withAdmin(handlePost);
