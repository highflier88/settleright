import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function CasesListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-20 animate-pulse bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="h-10 w-[180px] animate-pulse bg-muted rounded" />
            <div className="h-10 w-[180px] animate-pulse bg-muted rounded" />
            <div className="h-10 w-24 animate-pulse bg-muted rounded" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="h-5 w-24 animate-pulse bg-muted rounded" />
                  <div className="h-5 w-20 animate-pulse bg-muted rounded" />
                  <div className="h-5 w-16 animate-pulse bg-muted rounded" />
                </div>
                <div className="h-4 w-full animate-pulse bg-muted rounded" />
                <div className="h-4 w-2/3 animate-pulse bg-muted rounded" />
                <div className="flex gap-6">
                  <div className="h-4 w-24 animate-pulse bg-muted rounded" />
                  <div className="h-4 w-32 animate-pulse bg-muted rounded" />
                  <div className="h-4 w-20 animate-pulse bg-muted rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
