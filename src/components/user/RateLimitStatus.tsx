import { useState, useEffect } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { useVideoGenerationLimiter } from '@/hooks/useRateLimiter';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface UserRateLimitStatus {
  current_usage: number;
  max_allowed: number;
  remaining: number;
  reset_time: string;
  window_start: string;
}

export default function RateLimitStatus() {
  const { user } = useAuthContext();
  const { 
    getRemainingRequests, 
    getResetTime, 
    getStatus,
    config 
  } = useVideoGenerationLimiter();
  
  const [serverStatus, setServerStatus] = useState<UserRateLimitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 获取服务端限流状态
  const fetchServerStatus = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_rate_limit_status', {
        p_user_id: user.id,
        p_action: 'video_generation'
      });

      if (error) {
        console.error('Error fetching server rate limit status:', error);
        return;
      }

      if (data && data.length > 0) {
        const status = data[0];
        setServerStatus({
          current_usage: status.current_count,
          max_allowed: status.max_allowed,
          remaining: status.remaining,
          reset_time: status.reset_time,
          window_start: status.window_start
        });
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取本地限流状态
  const localRemaining = getRemainingRequests();
  const localResetTime = getResetTime();

  useEffect(() => {
    fetchServerStatus();
    // 每30秒自动刷新一次
    const interval = setInterval(fetchServerStatus, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    
    if (diff <= 0) return '已过期';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  const getStatusColor = (used: number, max: number) => {
    const percentage = (used / max) * 100;
    if (percentage >= 100) return 'text-destructive';
    if (percentage >= 80) return 'text-orange-500';
    if (percentage >= 60) return 'text-yellow-500';
    return 'text-green-500';
  };


  if (!user) {
    return (
      <Card>
        <CardContent className="text-center py-6">
          <p className="text-muted-foreground">请登录后查看使用限制</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              视频生成使用量
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchServerStatus}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 服务端状态 */}
          {serverStatus && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">当前使用情况</h4>
                <Badge variant="outline">
                  {serverStatus.current_usage}/{serverStatus.max_allowed}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>已使用</span>
                  <span className={getStatusColor(serverStatus.current_usage, serverStatus.max_allowed)}>
                    {serverStatus.current_usage} / {serverStatus.max_allowed}
                  </span>
                </div>
                <Progress 
                  value={(serverStatus.current_usage / serverStatus.max_allowed) * 100}
                  className="h-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground">剩余次数</span>
                  <div className="font-semibold text-lg">
                    {serverStatus.remaining}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">重置时间</span>
                  <div className="font-mono">
                    {formatDuration(serverStatus.reset_time)}
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                计数窗口：{formatTime(serverStatus.window_start)} - {formatTime(serverStatus.reset_time)}
              </div>
            </div>
          )}

          {/* 本地状态（调试用） */}
          <div className="border-t pt-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">本地状态 (调试)</h4>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">配置限制</span>
                  <div className="font-mono">{config.maxRequests}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">本地剩余</span>
                  <div className="font-mono">{localRemaining}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">本地重置</span>
                  <div className="font-mono">{formatTime(localResetTime)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 状态指示器 */}
          <div className="flex items-center gap-2 text-sm">
            {serverStatus && serverStatus.remaining > 0 ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-green-600">可以继续生成视频</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600">已达到使用限制</span>
              </>
            )}
          </div>

          {lastUpdated && (
            <div className="text-xs text-muted-foreground">
              最后更新：{formatTime(lastUpdated)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 使用提示 */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">使用说明</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 每小时限制生成 {config.maxRequests} 个视频</li>
              <li>• 计数器每小时自动重置</li>
              <li>• 升级订阅可获得更高限额</li>
              <li>• 如遇问题请联系客服</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}