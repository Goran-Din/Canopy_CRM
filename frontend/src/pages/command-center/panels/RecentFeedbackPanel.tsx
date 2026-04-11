import { useNavigate } from 'react-router-dom';
import { Star, ArrowRight, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FeedbackResponse {
  id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface RecentFeedbackPanelProps {
  feedback: FeedbackResponse[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn('h-3.5 w-3.5', i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200')}
        />
      ))}
    </div>
  );
}

export function RecentFeedbackPanel({ feedback }: RecentFeedbackPanelProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Recent Feedback</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {feedback.length > 0 ? (
          feedback.slice(0, 3).map((fb) => (
            <div
              key={fb.id}
              className={cn(
                'flex items-start gap-2 py-1.5 px-1 rounded text-sm',
                fb.rating <= 2 && 'bg-amber-50',
              )}
            >
              <StarRating rating={fb.rating} />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{fb.customer_name}</span>
                {fb.comment && (
                  <span className="text-muted-foreground ml-1">
                    "{fb.comment.length > 50 ? fb.comment.slice(0, 50) + '...' : fb.comment}"
                  </span>
                )}
              </div>
              {fb.rating <= 2 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">No feedback yet.</p>
        )}

        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/reports')}>
          View all feedback <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
