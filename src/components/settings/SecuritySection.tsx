import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Key, Shield, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const SecuritySection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();


  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-NG', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <CardDescription>
          Manage your password and security PIN
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="w-full h-12 justify-start"
          onClick={() => navigate('/change-password')}
        >
          <Key className="h-5 w-5 mr-3" />
          Change Password
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 justify-start"
          onClick={() => navigate('/change-pin')}
        >
          <Shield className="h-5 w-5 mr-3" />
          Change PIN
        </Button>

        {/* Activity Log */}
        <div className="pt-4 border-t mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Activity Log</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Last login: {new Intl.DateTimeFormat('en-NG', {
              timeZone: 'Africa/Lagos',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date(user?.last_sign_in_at || Date.now()))}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
