-- 查看 pg_net 的 HTTP 响应记录（最近的错误或失败）
SELECT
  id,
  status_code,
  error_msg,
  created,
  content,
  timed_out
FROM net._http_response
WHERE created > NOW() - INTERVAL '1 hour'
ORDER BY created DESC
LIMIT 20;

-- 查看所有 HTTP 请求队列
SELECT *
FROM net.http_request_queue
WHERE created > NOW() - INTERVAL '1 hour'
ORDER BY created DESC
LIMIT 20;
