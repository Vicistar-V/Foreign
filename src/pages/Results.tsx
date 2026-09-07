import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { useEarningsTimeline } from '@/hooks/useEarningsTimeline';
import { EarningsTimeline } from '@/components/earnings/EarningsTimeline';
import { GlobalStatsBar } from '@/components/earnings/GlobalStatsBar';
import { LivePulseIndicator } from '@/components/winners/LivePulseIndicator';

const Results = () => {
  const { days, globalStats, isLoading, refetch } = useEarningsTimeline(7, 20);

  useEffect(() => {
    trackClarityEvent(ClarityEvents.PAGE_VIEW_RESULTS);
  }, []);

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6 max-w-2xl">
      {/* Header */}
      <motion.div 
        className="mb-4 sm:mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                Campaign Payouts
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                See who's getting paid from finished campaigns
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="gap-1 text-muted-foreground"
            haptic="light"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <LivePulseIndicator />
      </motion.div>

      {/* Global Stats */}
      <motion.div 
        className="mb-4 sm:mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlobalStatsBar stats={globalStats} isLoading={isLoading} />
      </motion.div>

      {/* CTA Banner */}
      <motion.div
        className="mb-4 sm:mb-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-0.5">
                Want a payout like these?
              </p>
              <p className="text-xs text-muted-foreground">
                Activate an ad share and start earning
              </p>
            </div>
            <Button asChild size="sm" className="gap-1 shrink-0" haptic="medium">
              <Link to="/dashboard">
                Join Now
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Timeline - Day by Day */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Daily Earnings</h2>
          <span className="text-xs text-muted-foreground">
            Last {days.length} days
          </span>
        </div>

        <EarningsTimeline days={days} isLoading={isLoading} />
      </motion.div>

      {/* Bottom Spacing for Mobile Nav */}
      <div className="h-24" />
    </div>
  );
};

export default Results;
