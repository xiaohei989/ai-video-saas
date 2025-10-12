import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FaXTwitter, FaFacebook, FaDiscord, FaTiktok, FaInstagram } from 'react-icons/fa6'

export function Footer() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* 移动端：2列布局 (Quick Links + Legal)，桌面端：3列布局 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
          {/* Quick Links with underline animation */}
          <div>
            <h3 className="font-semibold mb-3">{t('footer.quickLinks')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/templates" className="link-hover inline-block text-muted-foreground">
                  {t('nav.templates')}
                </a>
              </li>
              <li>
                <a href="/pricing" className="link-hover inline-block text-muted-foreground">
                  {t('nav.pricing')}
                </a>
              </li>
              <li>
                <a href="/guides" className="link-hover inline-block text-muted-foreground">
                  {t('footer.userGuides')}
                </a>
              </li>
              <li>
                <a href="/help" className="link-hover inline-block text-muted-foreground">
                  {t('footer.helpCenter')}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal with slide-in effect - 在移动端排在右侧 */}
          <div>
            <h3 className="font-semibold mb-3">{t('footer.legal')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/privacy" className="link-hover inline-block text-muted-foreground">
                  {t('footer.privacyPolicy')}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="link-hover inline-block text-muted-foreground">
                  {t('footer.termsOfService')}
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="link-hover inline-block text-muted-foreground">
                  {t('footer.cookiePolicy')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Social with enhanced animations - 在移动端占据两列 */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="font-semibold mb-3">{t('footer.connect')}</h3>
            <div className="flex gap-4 justify-start md:justify-start">
              <a
                href="https://x.com/veo3video_me"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="X (Twitter)"
              >
                <FaXTwitter className="h-5 w-5" />
              </a>
              <a
                href="https://discord.com/invite/UxFhMG7fyY"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="Discord"
              >
                <FaDiscord className="h-5 w-5" />
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61579879903619"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="Facebook"
              >
                <FaFacebook className="h-5 w-5" />
              </a>
              <a
                href="https://www.tiktok.com/@veo3video.me"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="TikTok"
              >
                <FaTiktok className="h-5 w-5" />
              </a>
              <a
                href="https://www.instagram.com/veo3video.me"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="Instagram"
              >
                <FaInstagram className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>
            © {currentYear} veo3video.me. {t('footer.allRightsReserved')}
          </p>
        </div>
      </div>
    </footer>
  )
}