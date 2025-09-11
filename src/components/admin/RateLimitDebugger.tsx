import { useState, useEffect } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';
import { Trash2, RefreshCw, Eye, Settings } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface RateLimitRecord {
  rate_limit_key: string;
  current_count: number;
  max_allowed: number;
  remaining: number;
  window_start: string;
  window_end: string;
  reset_time: string;
}

interface RateLimitEvent {
  id: string;
  path: string;
  total_hits: number;
  limit_exceeded: boolean;
  ip_address: string;
  timestamp: string;
}

export default function RateLimitDebugger() {
  const { user } = useAuthContext();
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitRecord[]>([]);
  const [recentEvents, setRecentEvents] = useState<RateLimitEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [customLimitUserId, setCustomLimitUserId] = useState('');
  const [customLimitValue, setCustomLimitValue] = useState('200');
  const [debugOutput, setDebugOutput] = useState('');

  // 获取当前用户的限流状态
  const fetchRateLimitStatus = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        toast.error('请先登录');
        return;
      }

      const { data, error } = await supabase.rpc('get_rate_limit_status', {
        p_user_id: user.id,
        p_action: 'video_generation'
      });

      if (error) {
        console.error('Error fetching rate limit status:', error);
        toast.error('获取限流状态失败：' + error.message);
        return;
      }

      setRateLimitStatus(data || []);
      
      // 同时获取最近的限流事件
      const { data: events, error: eventsError } = await supabase
        .from('rate_limit_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (!eventsError) {
        setRecentEvents(events || []);
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 重置用户限流
  const resetUserRateLimit = async () => {
    if (!resetUserId.trim()) {
      toast.error('请输入用户ID');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('batch_reset_rate_limits', {
        p_user_ids: [resetUserId],
        p_actions: ['video_generation'],
        p_hours_back: 24
      });

      if (error) {
        console.error('Error resetting rate limit:', error);
        toast.error('重置失败：' + error.message);
        return;
      }

      toast.success('用户限流已重置');
      setDebugOutput(JSON.stringify(data, null, 2));
      await fetchRateLimitStatus();
    } catch (error) {
      console.error('Error:', error);
      toast.error('重置操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 设置自定义限流
  const setCustomRateLimit = async () => {
    if (!customLimitUserId.trim()) {
      toast.error('请输入用户ID');
      return;
    }

    const limitValue = parseInt(customLimitValue);
    if (isNaN(limitValue) || limitValue < 1) {
      toast.error('请输入有效的限制数量');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('set_user_rate_limit', {
        p_user_id: customLimitUserId,
        p_action: 'video_generation',
        p_max_requests: limitValue,
        p_window_seconds: 3600
      });

      if (error) {
        console.error('Error setting custom rate limit:', error);
        toast.error('设置失败：' + error.message);
        return;
      }

      toast.success('自定义限流已设置');
      setDebugOutput(data);
      await fetchRateLimitStatus();
    } catch (error) {
      console.error('Error:', error);
      toast.error('设置操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 清理所有限流记录
  const cleanupAllRateLimits = async () => {
    if (!confirm('确定要清理所有限流记录吗？这将重置所有用户的限流状态。')) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('cleanup_rate_limit_data_v2');

      if (error) {
        console.error('Error cleaning up:', error);
        toast.error('清理失败：' + error.message);
        return;
      }

      toast.success('限流记录已清理');
      setDebugOutput(JSON.stringify(data, null, 2));
      await fetchRateLimitStatus();
    } catch (error) {
      console.error('Error:', error);
      toast.error('清理操作失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRateLimitStatus();
  }, [user?.id]);

  const getStatusColor = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 100) return 'destructive';
    if (percentage >= 80) return 'secondary';
    return 'default';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            限流状态监控
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Button onClick={fetchRateLimitStatus} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新状态
            </Button>
            <Badge variant="outline">
              用户ID: {user?.id || '未登录'}
            </Badge>
          </div>

          {rateLimitStatus.length > 0 ? (
            <div className="space-y-3">
              {rateLimitStatus.map((status, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm text-muted-foreground">
                      {status.rate_limit_key}
                    </span>
                    <Badge variant={getStatusColor(status.current_count, status.max_allowed)}>
                      {status.current_count}/{status.max_allowed}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">已使用:</span>
                      <div className="font-semibold">{status.current_count}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">剩余:</span>
                      <div className="font-semibold">{status.remaining}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">窗口开始:</span>
                      <div className="font-mono">{new Date(status.window_start).toLocaleTimeString()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">重置时间:</span>
                      <div className="font-mono">{new Date(status.reset_time).toLocaleTimeString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              没有找到当前用户的限流记录
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            限流管理工具
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 重置用户限流 */}
          <div className="space-y-3">
            <Label>重置用户限流</Label>
            <div className="flex gap-2">
              <Input
                placeholder="输入用户ID"
                value={resetUserId}
                onChange={(e) => setResetUserId(e.target.value)}
                className="flex-1"
              />
              <Button onClick={resetUserRateLimit} disabled={loading}>
                <Trash2 className="h-4 w-4 mr-2" />
                重置
              </Button>
            </div>
          </div>

          {/* 设置自定义限流 */}
          <div className="space-y-3">
            <Label>设置自定义限流</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="用户ID"
                value={customLimitUserId}
                onChange={(e) => setCustomLimitUserId(e.target.value)}
              />
              <Input
                placeholder="限制数量/小时"
                value={customLimitValue}
                onChange={(e) => setCustomLimitValue(e.target.value)}
                type="number"
              />
            </div>
            <Button onClick={setCustomRateLimit} disabled={loading} className="w-full">
              设置自定义限流
            </Button>
          </div>

          {/* 批量清理 */}
          <div className="space-y-3">
            <Label>系统维护</Label>
            <Button onClick={cleanupAllRateLimits} disabled={loading} variant="destructive" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              清理所有限流记录（危险操作）
            </Button>
          </div>
        </CardContent>
      </Card>

      {recentEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>最近限流事件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant={event.limit_exceeded ? 'destructive' : 'default'}>
                      {event.limit_exceeded ? '超限' : '正常'}
                    </Badge>
                    <span className="text-sm">{event.path}</span>
                    <span className="text-xs text-muted-foreground">{event.ip_address}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {debugOutput && (
        <Card>
          <CardHeader>
            <CardTitle>调试输出</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={debugOutput}
              readOnly
              className="font-mono text-sm"
              rows={10}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}