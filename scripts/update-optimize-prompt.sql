-- 更新 seo-optimize 提示词模板，在结尾添加严格的 JSON 输出约束
UPDATE ai_prompt_templates
SET prompt_template = CONCAT(
  prompt_template,
  E'\n\n⚠️⚠️⚠️ **CRITICAL OUTPUT FORMAT REQUIREMENT** ⚠️⚠️⚠️\n\n',
  E'YOU MUST RETURN **PURE JSON ONLY**. NO explanations, NO commentary, NO additional text.\n\n',
  E'**ABSOLUTELY FORBIDDEN:**\n',
  E'❌ "我看到您..." / "I see you..."\n',
  E'❌ "这是优化结果..." / "Here is the result..."\n',
  E'❌ "已完成优化..." / "Optimization complete..."\n',
  E'❌ ANY form of explanation, summary, or comment\n',
  E'❌ Markdown code blocks like ```json or ```\n\n',
  E'**REQUIRED FORMAT:**\n',
  E'1. Output MUST start with { and end with }\n',
  E'2. NO characters before { or after } (including spaces, newlines)\n',
  E'3. Must be valid JSON with proper escaping\n\n',
  E'**Correct example:**\n',
  E'{"optimized_content":{"meta_title":"...","guide_content":"..."},"optimization_summary":"...","key_improvements":["..."]}\n\n',
  E'**Remember:** 100% {{languageName}}! Now output JSON immediately with NO other text!'
)
WHERE name = 'seo-optimize';
