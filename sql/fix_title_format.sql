-- 修复视频标题格式：移除中文前缀,只保留JSON部分
-- 问题: title = '有趣的{"en":"...","zh":"..."}'
-- 修复后: title = '{"en":"...","zh":"..."}'

-- 查看需要修复的标题
SELECT
  id,
  title,
  substring(title from '\{(?:[^{}]|"[^"]*")*\}') as extracted_json
FROM videos
WHERE title ~ '^.+\{.*\}$'  -- 匹配"前缀+JSON"格式
  AND title !~ '^\{.*\}$'    -- 排除已经是纯JSON格式的
LIMIT 10;

-- 执行修复
UPDATE videos
SET title = substring(title from '\{(?:[^{}]|"[^"]*")*\}')
WHERE title ~ '^.+\{.*\}$'  -- 匹配"前缀+JSON"格式
  AND title !~ '^\{.*\}$'   -- 排除已经是纯JSON格式的
  AND substring(title from '\{(?:[^{}]|"[^"]*")*\}') IS NOT NULL;

-- 验证修复结果
SELECT
  COUNT(*) as fixed_count,
  COUNT(CASE WHEN title ~ '^\{.*\}$' THEN 1 END) as valid_json_count
FROM videos
WHERE title IS NOT NULL;
