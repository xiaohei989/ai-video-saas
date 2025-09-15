-- 修改profiles表的默认积分为50
ALTER TABLE public.profiles 
ALTER COLUMN credits SET DEFAULT 50;

ALTER TABLE public.profiles 
ALTER COLUMN total_credits_earned SET DEFAULT 50;