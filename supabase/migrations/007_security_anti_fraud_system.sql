-- ============================================
-- 安全防刷系统数据库迁移
-- Version: 007
-- Description: 添加IP注册限制、设备指纹、速率限制等防刷机制
-- ============================================

-- ============================================
-- 1. IP注册尝试记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.ip_registration_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address INET NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT false,
  failure_reason TEXT,
  device_fingerprint JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 邀请速率限制记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.invitation_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address INET,
  invitations_created INTEGER DEFAULT 1,
  last_invitation_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, DATE(created_at))
);

-- ============================================
-- 3. 认证失败尝试记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.auth_failure_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address INET NOT NULL,
  email TEXT,
  attempt_type VARCHAR(20) NOT NULL, -- 'login', 'signup', 'password_reset'
  failure_reason TEXT,
  user_agent TEXT,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. 设备指纹记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  fingerprint_hash VARCHAR(64) NOT NULL,
  fingerprint_data JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  registration_count INTEGER DEFAULT 0,
  is_suspicious BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. 临时邮箱域名黑名单表
-- ============================================
CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain VARCHAR(255) NOT NULL UNIQUE,
  reason TEXT DEFAULT 'temporary_email',
  is_active BOOLEAN DEFAULT true,
  added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 索引优化
-- ============================================

-- IP注册尝试表索引
CREATE INDEX IF NOT EXISTS idx_ip_registration_attempts_ip ON public.ip_registration_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_registration_attempts_created_at ON public.ip_registration_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_ip_registration_attempts_success ON public.ip_registration_attempts(success);
CREATE INDEX IF NOT EXISTS idx_ip_registration_attempts_ip_success_time ON public.ip_registration_attempts(ip_address, success, created_at);

-- 邀请速率限制表索引
CREATE INDEX IF NOT EXISTS idx_invitation_rate_limits_user_id ON public.invitation_rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_invitation_rate_limits_ip ON public.invitation_rate_limits(ip_address);
CREATE INDEX IF NOT EXISTS idx_invitation_rate_limits_created_at ON public.invitation_rate_limits(created_at);

-- 认证失败尝试表索引
CREATE INDEX IF NOT EXISTS idx_auth_failure_attempts_ip ON public.auth_failure_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_failure_attempts_email ON public.auth_failure_attempts(email);
CREATE INDEX IF NOT EXISTS idx_auth_failure_attempts_created_at ON public.auth_failure_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_failure_attempts_ip_type_time ON public.auth_failure_attempts(ip_address, attempt_type, created_at);

-- 设备指纹表索引
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_hash ON public.device_fingerprints(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user_id ON public.device_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_ip ON public.device_fingerprints(ip_address);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_suspicious ON public.device_fingerprints(is_suspicious);

-- 黑名单域名表索引
CREATE INDEX IF NOT EXISTS idx_blocked_email_domains_domain ON public.blocked_email_domains(domain);
CREATE INDEX IF NOT EXISTS idx_blocked_email_domains_active ON public.blocked_email_domains(is_active);

-- ============================================
-- RLS策略
-- ============================================

-- 启用RLS
ALTER TABLE public.ip_registration_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_failure_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;

-- IP注册尝试策略
CREATE POLICY "Service role can manage all ip attempts" ON public.ip_registration_attempts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own ip attempts" ON public.ip_registration_attempts
  FOR SELECT USING (auth.uid() = user_id);

-- 邀请速率限制策略
CREATE POLICY "Service role can manage invitation limits" ON public.invitation_rate_limits
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own invitation limits" ON public.invitation_rate_limits
  FOR SELECT USING (auth.uid() = user_id);

-- 认证失败尝试策略（只有service role可访问）
CREATE POLICY "Service role can manage auth failures" ON public.auth_failure_attempts
  FOR ALL USING (auth.role() = 'service_role');

-- 设备指纹策略
CREATE POLICY "Service role can manage device fingerprints" ON public.device_fingerprints
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own device fingerprints" ON public.device_fingerprints
  FOR SELECT USING (auth.uid() = user_id);

-- 黑名单域名策略（公开读取）
CREATE POLICY "Anyone can view blocked domains" ON public.blocked_email_domains
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage blocked domains" ON public.blocked_email_domains
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 触发器和函数
-- ============================================

-- 更新邀请速率限制表的updated_at字段
CREATE TRIGGER update_invitation_rate_limits_updated_at 
  BEFORE UPDATE ON public.invitation_rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_device_fingerprints_updated_at 
  BEFORE UPDATE ON public.device_fingerprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 初始化黑名单域名数据
-- ============================================

INSERT INTO public.blocked_email_domains (domain, reason) VALUES
-- 原有的临时邮箱域名
('10minutemail.com', 'temporary_email'),
('guerrillamail.com', 'temporary_email'),
('mailinator.com', 'temporary_email'),
('temp-mail.org', 'temporary_email'),
('throwaway.email', 'temporary_email'),
('yopmail.com', 'temporary_email'),
('maildrop.cc', 'temporary_email'),
('mintemail.com', 'temporary_email'),
('sharklasers.com', 'temporary_email'),
('guerrillamail.biz', 'temporary_email'),
('guerrillamail.net', 'temporary_email'),
('guerrillamail.org', 'temporary_email'),
('emailondeck.com', 'temporary_email'),
('tempail.com', 'temporary_email'),
('getnada.com', 'temporary_email'),
('dispostable.com', 'temporary_email'),
('fakeinbox.com', 'temporary_email'),
('spamgourmet.com', 'temporary_email'),
('mytrashmail.com', 'temporary_email'),
('trbvm.com', 'temporary_email'),
-- 新增的临时邮箱域名
('tempmail.plus', 'temporary_email'),
('20minutemail.it', 'temporary_email'),
('33mail.com', 'temporary_email'),
('anonaddy.me', 'temporary_email'),
('blogtoemail.com', 'temporary_email'),
('bobmail.info', 'temporary_email'),
('cheap-email.com', 'temporary_email'),
('coolmail.tk', 'temporary_email'),
('deadaddress.com', 'temporary_email'),
('emailisvalid.com', 'temporary_email'),
('freemails.tk', 'temporary_email'),
('getairmail.com', 'temporary_email'),
('guerrillamailblock.com', 'temporary_email'),
('incognitomail.org', 'temporary_email'),
('jetable.org', 'temporary_email'),
('mailcatch.com', 'temporary_email'),
('mailforspam.com', 'temporary_email'),
('mailnesia.com', 'temporary_email'),
('mailnull.com', 'temporary_email'),
('mailtemp.info', 'temporary_email'),
('nowmymail.com', 'temporary_email'),
('receivemail.org', 'temporary_email'),
('tempmail.net', 'temporary_email'),
('temporarymail.com', 'temporary_email'),
('trashmail.com', 'temporary_email'),
('wegwerfmail.de', 'temporary_email'),
('zerobounce.net', 'temporary_email'),
-- 更多常见的临时邮箱服务
('mohmal.com', 'temporary_email'),
('guerrillamail.de', 'temporary_email'),
('grr.la', 'temporary_email'),
('guerrillamail.co.uk', 'temporary_email'),
('guerrillamail.info', 'temporary_email'),
('sharklasers.com', 'temporary_email'),
('spam4.me', 'temporary_email'),
('guerrillamail.biz', 'temporary_email'),
('pokemail.net', 'temporary_email'),
('spam4.me', 'temporary_email'),
('guerrillamail.de', 'temporary_email'),
('grr.la', 'temporary_email'),
('guerrillamail.biz', 'temporary_email'),
('guerrillamail.co.uk', 'temporary_email'),
('guerrillamail.info', 'temporary_email'),
('guerrillamail.net', 'temporary_email'),
('guerrillamail.org', 'temporary_email'),
('pokemail.net', 'temporary_email'),
('spam4.me', 'temporary_email'),
('mailcatch.com', 'temporary_email'),
('mailinator.net', 'temporary_email'),
('notmailinator.com', 'temporary_email'),
('veryrealemail.com', 'temporary_email'),
('chammy.info', 'temporary_email'),
('trashmail.de', 'temporary_email'),
('kurzepost.de', 'temporary_email'),
('objectmail.com', 'temporary_email'),
('proxymail.eu', 'temporary_email'),
('rcpt.at', 'temporary_email'),
('trash2009.com', 'temporary_email'),
('mytrashmail.com', 'temporary_email'),
('mailexpire.com', 'temporary_email'),
('mailfreeonline.com', 'temporary_email'),
('10minutemail.net', 'temporary_email'),
('10minutemail.de', 'temporary_email'),
('anonbox.net', 'temporary_email'),
('binkmail.com', 'temporary_email'),
('bobmail.info', 'temporary_email'),
('deadaddress.com', 'temporary_email'),
('despam.it', 'temporary_email'),
('dontsendmespam.de', 'temporary_email'),
('emailwarden.com', 'temporary_email'),
('enterto.com', 'temporary_email'),
('fakedemail.com', 'temporary_email'),
('fleckens.hu', 'temporary_email'),
('hidemail.de', 'temporary_email'),
('kasmail.com', 'temporary_email'),
('lifebyfood.com', 'temporary_email'),
('lookugly.com', 'temporary_email'),
('lopl.co.cc', 'temporary_email'),
('mail.by', 'temporary_email'),
('mail.mezimages.net', 'temporary_email'),
('mail2rss.org', 'temporary_email'),
('mailbidon.com', 'temporary_email'),
('mailcatch.com', 'temporary_email'),
('maileater.com', 'temporary_email'),
('mailed.ro', 'temporary_email'),
('mailexpire.com', 'temporary_email'),
('mailfreeonline.com', 'temporary_email'),
('mailguard.me', 'temporary_email'),
('mailimate.com', 'temporary_email'),
('mailinator2.com', 'temporary_email'),
('mailincubator.com', 'temporary_email'),
('mailme.lv', 'temporary_email'),
('mailnator.com', 'temporary_email'),
('mailnesia.com', 'temporary_email'),
('mailnull.com', 'temporary_email'),
('mailpick.biz', 'temporary_email'),
('mailrock.biz', 'temporary_email'),
('mailscrap.com', 'temporary_email'),
('mailshell.com', 'temporary_email'),
('mailsiphon.com', 'temporary_email'),
('mailtemp.info', 'temporary_email'),
('mailtome.de', 'temporary_email'),
('mailtothis.com', 'temporary_email'),
('mailzilla.org', 'temporary_email'),
('mbx.cc', 'temporary_email'),
('mega.zik.dj', 'temporary_email'),
('meltmail.com', 'temporary_email'),
('mierdamail.com', 'temporary_email'),
('mintemail.com', 'temporary_email'),
('mjukglass.nu', 'temporary_email'),
('mt2009.com', 'temporary_email'),
('mx0.wwwnew.eu', 'temporary_email'),
('mypartyclip.de', 'temporary_email'),
('myphantomemail.com', 'temporary_email'),
('myspaceinc.com', 'temporary_email'),
('myspaceinc.net', 'temporary_email'),
('myspaceinc.org', 'temporary_email'),
('myspacepimpedup.com', 'temporary_email'),
('myspamless.com', 'temporary_email'),
('mytrashmail.com', 'temporary_email'),
('nepwk.com', 'temporary_email'),
('nervmich.net', 'temporary_email'),
('nervtmich.net', 'temporary_email'),
('netmails.com', 'temporary_email'),
('netmails.net', 'temporary_email'),
('neverbox.com', 'temporary_email'),
('no-spam.ws', 'temporary_email'),
('nobulk.com', 'temporary_email'),
('noclickemail.com', 'temporary_email'),
('nogmailspam.info', 'temporary_email'),
('nomail.xl.cx', 'temporary_email'),
('nomail2me.com', 'temporary_email'),
('nomorespamemails.com', 'temporary_email'),
('nospam.ze.tc', 'temporary_email'),
('nospam4.us', 'temporary_email'),
('nospamfor.us', 'temporary_email'),
('nospammail.net', 'temporary_email'),
('nospamthanks.info', 'temporary_email'),
('notmailinator.com', 'temporary_email'),
('nowmymail.com', 'temporary_email'),
('nurfuerspam.de', 'temporary_email'),
('objectmail.com', 'temporary_email'),
('obobbo.com', 'temporary_email'),
('oneoffemail.com', 'temporary_email'),
('onewaymail.com', 'temporary_email'),
('owlpic.com', 'temporary_email'),
('pookmail.com', 'temporary_email'),
('proxymail.eu', 'temporary_email'),
('rcpt.at', 'temporary_email'),
('reallymymail.com', 'temporary_email'),
('receivemail.org', 'temporary_email'),
('recode.me', 'temporary_email'),
('recursor.net', 'temporary_email'),
('regbypass.comsafe-mail.net', 'temporary_email'),
('safetymail.info', 'temporary_email'),
('sandelf.de', 'temporary_email'),
('saynotospams.com', 'temporary_email'),
('selfdestructingmail.com', 'temporary_email'),
('sharklasers.com', 'temporary_email'),
('shieldedmail.com', 'temporary_email'),
('shitmail.me', 'temporary_email'),
('shitware.nl', 'temporary_email'),
('shortmail.net', 'temporary_email'),
('sibmail.com', 'temporary_email'),
('skeefmail.com', 'temporary_email'),
('slopsbox.com', 'temporary_email'),
('smellfear.com', 'temporary_email'),
('snakemail.com', 'temporary_email'),
('sneakemail.com', 'temporary_email'),
('snkmail.com', 'temporary_email'),
('sofortmail.de', 'temporary_email'),
('sogetthis.com', 'temporary_email'),
('sohu.com', 'suspicious_domain'),
('soodonims.com', 'temporary_email'),
('spam.la', 'temporary_email'),
('spam.su', 'temporary_email'),
('spam4.me', 'temporary_email'),
('spamail.de', 'temporary_email'),
('spambob.com', 'temporary_email'),
('spambob.net', 'temporary_email'),
('spambob.org', 'temporary_email'),
('spambox.us', 'temporary_email'),
('spamcannon.com', 'temporary_email'),
('spamcannon.net', 'temporary_email'),
('spamcon.org', 'temporary_email'),
('spamcorptastic.com', 'temporary_email'),
('spamcowboy.com', 'temporary_email'),
('spamcowboy.net', 'temporary_email'),
('spamcowboy.org', 'temporary_email'),
('spamday.com', 'temporary_email'),
('spamex.com', 'temporary_email'),
('spamfree24.com', 'temporary_email'),
('spamfree24.de', 'temporary_email'),
('spamfree24.eu', 'temporary_email'),
('spamfree24.net', 'temporary_email'),
('spamfree24.org', 'temporary_email'),
('spamgourmet.com', 'temporary_email'),
('spamgourmet.net', 'temporary_email'),
('spamgourmet.org', 'temporary_email'),
('spamhole.com', 'temporary_email'),
('spamify.com', 'temporary_email'),
('spaminator.de', 'temporary_email'),
('spamkill.info', 'temporary_email'),
('spaml.com', 'temporary_email'),
('spaml.de', 'temporary_email'),
('spammotel.com', 'temporary_email'),
('spamobox.com', 'temporary_email'),
('spamspot.com', 'temporary_email'),
('spamstack.net', 'temporary_email'),
('spamthis.co.uk', 'temporary_email'),
('spamthisplease.com', 'temporary_email'),
('spamtrail.com', 'temporary_email'),
('spamtroll.net', 'temporary_email'),
('speed.1s.fr', 'temporary_email'),
('squizzy.de', 'temporary_email'),
('supergreatmail.com', 'temporary_email'),
('supermailer.jp', 'temporary_email'),
('superrito.com', 'temporary_email'),
('superstachel.de', 'temporary_email'),
('suremail.info', 'temporary_email'),
('teewars.org', 'temporary_email'),
('teleworm.com', 'temporary_email'),
('teleworm.us', 'temporary_email'),
('temp-mail.ru', 'temporary_email'),
('tempalias.com', 'temporary_email'),
('tempe-mail.com', 'temporary_email'),
('tempemail.biz', 'temporary_email'),
('tempemail.com', 'temporary_email'),
('tempinbox.co.uk', 'temporary_email'),
('tempinbox.com', 'temporary_email'),
('tempmail.eu', 'temporary_email'),
('tempmail2.com', 'temporary_email'),
('tempmaildemo.com', 'temporary_email'),
('tempmailer.com', 'temporary_email'),
('tempmailer.de', 'temporary_email'),
('tempomail.fr', 'temporary_email'),
('temporarioemail.com.br', 'temporary_email'),
('temporaryemail.net', 'temporary_email'),
('temporaryforwarding.com', 'temporary_email'),
('temporaryinbox.com', 'temporary_email'),
('temporarymailaddress.com', 'temporary_email'),
('tempymail.com', 'temporary_email'),
('thanksnospam.info', 'temporary_email'),
('thankyou2010.com', 'temporary_email'),
('thecloudindex.com', 'temporary_email'),
('thisisnotmyrealemail.com', 'temporary_email'),
('thismail.net', 'temporary_email'),
('throam.com', 'temporary_email'),
('throwawayemailaddresses.com', 'temporary_email'),
('tilien.com', 'temporary_email'),
('tittbit.in', 'temporary_email'),
('tmail.ws', 'temporary_email'),
('tmailinator.com', 'temporary_email'),
('toiea.com', 'temporary_email'),
('toomail.biz', 'temporary_email'),
('topranklist.de', 'temporary_email'),
('tradermail.info', 'temporary_email'),
('trash-amil.com', 'temporary_email'),
('trash-mail.at', 'temporary_email'),
('trash-mail.com', 'temporary_email'),
('trash-mail.de', 'temporary_email'),
('trash2009.com', 'temporary_email'),
('trashdevil.com', 'temporary_email'),
('trashemail.de', 'temporary_email'),
('trashemailsystem.com', 'temporary_email'),
('trashmail.at', 'temporary_email'),
('trashmail.com', 'temporary_email'),
('trashmail.de', 'temporary_email'),
('trashmail.me', 'temporary_email'),
('trashmail.net', 'temporary_email'),
('trashmail.org', 'temporary_email'),
('trashmail.ws', 'temporary_email'),
('trashmailer.com', 'temporary_email'),
('trashymail.com', 'temporary_email'),
('trashymail.net', 'temporary_email'),
('trbvm.com', 'temporary_email'),
('trialmail.de', 'temporary_email'),
('tryalert.com', 'temporary_email'),
('turual.com', 'temporary_email'),
('twinmail.de', 'temporary_email'),
('twoweirdtricks.com', 'temporary_email'),
('tyldd.com', 'temporary_email'),
('uggsrock.com', 'temporary_email'),
('umail.net', 'temporary_email'),
('upliftnow.com', 'temporary_email'),
('uplipht.com', 'temporary_email'),
('uroid.com', 'temporary_email'),
('us.af', 'temporary_email'),
('venompen.com', 'temporary_email'),
('veryrealemail.com', 'temporary_email'),
('vidchart.com', 'temporary_email'),
('viditag.com', 'temporary_email'),
('viewcastmedia.com', 'temporary_email'),
('viewcastmedia.net', 'temporary_email'),
('viewcastmedia.org', 'temporary_email'),
('vomoto.com', 'temporary_email'),
('vpn.st', 'temporary_email'),
('vsimcard.com', 'temporary_email'),
('vubby.com', 'temporary_email'),
('walala.org', 'temporary_email'),
('walkmail.net', 'temporary_email'),
('webemail.me', 'temporary_email'),
('webm4il.info', 'temporary_email'),
('webuser.in', 'temporary_email'),
('wh4f.org', 'temporary_email'),
('whatiaas.com', 'temporary_email'),
('whatpaas.com', 'temporary_email'),
('whatsaas.com', 'temporary_email'),
('whopy.com', 'temporary_email'),
('willselfdestruct.com', 'temporary_email'),
('winemaven.info', 'temporary_email'),
('wronghead.com', 'temporary_email'),
('wuzup.net', 'temporary_email'),
('wuzupmail.net', 'temporary_email'),
('www.e4ward.com', 'temporary_email'),
('www.gishpuppy.com', 'temporary_email'),
('www.mailinator.com', 'temporary_email'),
('wwwnew.eu', 'temporary_email'),
('x.ip6.li', 'temporary_email'),
('xagloo.com', 'temporary_email'),
('xemaps.com', 'temporary_email'),
('xents.com', 'temporary_email'),
('xmaily.com', 'temporary_email'),
('xoxy.net', 'temporary_email'),
('yapped.net', 'temporary_email'),
('yeah.net', 'suspicious_domain'),
('yep.it', 'temporary_email'),
('yogamaven.com', 'temporary_email'),
('yopmail.com', 'temporary_email'),
('yopmail.fr', 'temporary_email'),
('yopmail.net', 'temporary_email'),
('ypmail.webredirect.org', 'temporary_email'),
('yuurok.com', 'temporary_email'),
('z1p.biz', 'temporary_email'),
('za.com', 'temporary_email'),
('zehnminutenmail.de', 'temporary_email'),
('zetmail.com', 'temporary_email'),
('zippymail.info', 'temporary_email'),
('zoaxe.com', 'temporary_email'),
('zoemail.net', 'temporary_email'),
('zoemail.org', 'temporary_email'),
('zomg.info', 'temporary_email'),
('zxcv.com', 'temporary_email'),
('zxcvbnm.com', 'temporary_email'),
('zzz.com', 'temporary_email')
ON CONFLICT (domain) DO NOTHING;

-- ============================================
-- 完成
-- ============================================