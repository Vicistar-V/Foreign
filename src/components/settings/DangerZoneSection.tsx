import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Lock, MessageCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const DangerZoneSection = () => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Help & Support</CardTitle>
        <CardDescription>
          Get help and view legal information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Primary: Get Help button */}
        <Button
          variant="default"
          className="w-full h-14 justify-between text-base"
          onClick={() => navigate('/support')}
        >
          <div className="flex items-center">
            <MessageCircle className="h-5 w-5 mr-3" />
            <span>Get Help</span>
          </div>
          <ChevronRight className="h-5 w-5" />
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 justify-start"
          asChild
        >
          <a 
            href="/terms"
            className="flex items-center"
          >
            <FileText className="h-5 w-5 mr-3" />
            <span className="flex-1 text-left">Terms & Conditions</span>
          </a>
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 justify-start"
          asChild
        >
          <a 
            href="/privacy"
            className="flex items-center"
          >
            <Lock className="h-5 w-5 mr-3" />
            <span className="flex-1 text-left">Privacy Policy</span>
          </a>
        </Button>
      </CardContent>
    </Card>
  );
};
