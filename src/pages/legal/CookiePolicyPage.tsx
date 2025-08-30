import React from 'react'
import { useTranslation } from 'react-i18next'
import { LegalPageLayout } from './LegalPageLayout'

export default function CookiePolicyPage() {
  const { t } = useTranslation()

  const tableOfContents = [
    { id: 'overview', title: 'Overview', level: 1 },
    { id: 'what-are-cookies', title: 'What are Cookies?', level: 1 },
    { id: 'how-we-use-cookies', title: 'How We Use Cookies', level: 1 },
    { id: 'types-of-cookies', title: 'Types of Cookies We Use', level: 1 },
    { id: 'essential-cookies', title: 'Essential Cookies', level: 2 },
    { id: 'functional-cookies', title: 'Functional Cookies', level: 2 },
    { id: 'analytical-cookies', title: 'Analytical Cookies', level: 2 },
    { id: 'marketing-cookies', title: 'Marketing Cookies', level: 2 },
    { id: 'third-party-cookies', title: 'Third-Party Cookies', level: 1 },
    { id: 'google-analytics', title: 'Google Analytics', level: 2 },
    { id: 'stripe-payments', title: 'Stripe Payments', level: 2 },
    { id: 'social-media', title: 'Social Media Integration', level: 2 },
    { id: 'cookie-duration', title: 'Cookie Duration', level: 1 },
    { id: 'managing-cookies', title: 'Managing Your Cookie Preferences', level: 1 },
    { id: 'browser-settings', title: 'Browser Settings', level: 2 },
    { id: 'opt-out-tools', title: 'Opt-Out Tools', level: 2 },
    { id: 'consent-management', title: 'Consent Management', level: 1 },
    { id: 'your-rights', title: 'Your Rights', level: 1 },
    { id: 'policy-updates', title: 'Policy Updates', level: 1 },
    { id: 'contact', title: 'Contact Information', level: 1 },
  ]

  return (
    <LegalPageLayout
      title={t('legal.cookiePolicy.title')}
      lastUpdated="January 29, 2025"
      tableOfContents={tableOfContents}
      pageType="cookiePolicy"
    >
      <section id="overview">
        <h2>1. Overview</h2>
        <p>
          This Cookie Policy explains how Veo3Video.me ("we," "us," or "our") uses cookies 
          and similar tracking technologies when you visit our website and use our services.
        </p>
        <p>
          This policy should be read together with our Privacy Policy and Terms of Service. 
          By using our website, you consent to the use of cookies as described in this policy.
        </p>
        <p>
          We are committed to transparency about our data practices and providing you with 
          control over your privacy preferences.
        </p>
      </section>

      <section id="what-are-cookies">
        <h2>2. What are Cookies?</h2>
        <p>
          Cookies are small text files that are placed on your device (computer, smartphone, 
          or tablet) when you visit a website. They are widely used to make websites work 
          more efficiently and provide a better user experience.
        </p>
        <p>
          Cookies serve several purposes:
        </p>
        <ul>
          <li>Remember your preferences and settings</li>
          <li>Enable website functionality</li>
          <li>Analyze website performance and usage</li>
          <li>Provide personalized content and advertisements</li>
          <li>Ensure website security</li>
        </ul>
        <p>
          Similar technologies include web beacons, pixels, and local storage, 
          which serve similar purposes to cookies.
        </p>
      </section>

      <section id="how-we-use-cookies">
        <h2>3. How We Use Cookies</h2>
        <p>
          We use cookies to:
        </p>
        <ul>
          <li><strong>Provide core functionality:</strong> Essential features like user authentication and session management</li>
          <li><strong>Remember your preferences:</strong> Language settings, theme choices, and user interface customizations</li>
          <li><strong>Improve our service:</strong> Analytics to understand how users interact with our platform</li>
          <li><strong>Enhance security:</strong> Detect and prevent fraudulent activities</li>
          <li><strong>Personalize experience:</strong> Customize content based on your interests and usage patterns</li>
          <li><strong>Marketing and advertising:</strong> Deliver relevant advertisements and measure campaign effectiveness</li>
        </ul>
      </section>

      <section id="types-of-cookies">
        <h2>4. Types of Cookies We Use</h2>
        <p>
          We categorize cookies based on their purpose and function:
        </p>

        <div id="essential-cookies">
          <h3>4.1 Essential Cookies (Always Active)</h3>
          <p>
            These cookies are necessary for the website to function properly and cannot be disabled. 
            They are usually set in response to actions you take, such as logging in or filling forms.
          </p>
          <table className="w-full border-collapse border border-gray-300 mt-4 mb-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 p-2 text-left">Cookie Name</th>
                <th className="border border-gray-300 p-2 text-left">Purpose</th>
                <th className="border border-gray-300 p-2 text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2">session_token</td>
                <td className="border border-gray-300 p-2">User authentication and session management</td>
                <td className="border border-gray-300 p-2">Session</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">csrf_token</td>
                <td className="border border-gray-300 p-2">Security protection against cross-site attacks</td>
                <td className="border border-gray-300 p-2">Session</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">cookie_consent</td>
                <td className="border border-gray-300 p-2">Remember your cookie preferences</td>
                <td className="border border-gray-300 p-2">1 year</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div id="functional-cookies">
          <h3>4.2 Functional Cookies</h3>
          <p>
            These cookies enable enhanced functionality and personalization, 
            such as remembering your preferences and settings.
          </p>
          <table className="w-full border-collapse border border-gray-300 mt-4 mb-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 p-2 text-left">Cookie Name</th>
                <th className="border border-gray-300 p-2 text-left">Purpose</th>
                <th className="border border-gray-300 p-2 text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2">user_language</td>
                <td className="border border-gray-300 p-2">Remember your language preference</td>
                <td className="border border-gray-300 p-2">1 year</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">theme_preference</td>
                <td className="border border-gray-300 p-2">Remember dark/light theme choice</td>
                <td className="border border-gray-300 p-2">1 year</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">user_settings</td>
                <td className="border border-gray-300 p-2">Store user interface preferences</td>
                <td className="border border-gray-300 p-2">6 months</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div id="analytical-cookies">
          <h3>4.3 Analytical Cookies</h3>
          <p>
            These cookies help us understand how visitors interact with our website 
            by collecting and reporting information anonymously.
          </p>
          <table className="w-full border-collapse border border-gray-300 mt-4 mb-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 p-2 text-left">Cookie Name</th>
                <th className="border border-gray-300 p-2 text-left">Purpose</th>
                <th className="border border-gray-300 p-2 text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2">_ga</td>
                <td className="border border-gray-300 p-2">Google Analytics - distinguish users</td>
                <td className="border border-gray-300 p-2">2 years</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">_ga_*</td>
                <td className="border border-gray-300 p-2">Google Analytics - session data</td>
                <td className="border border-gray-300 p-2">2 years</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">usage_analytics</td>
                <td className="border border-gray-300 p-2">Internal analytics for service improvement</td>
                <td className="border border-gray-300 p-2">30 days</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div id="marketing-cookies">
          <h3>4.4 Marketing Cookies</h3>
          <p>
            These cookies are used to deliver advertisements that are relevant to you 
            and your interests. They may also be used to limit the number of times 
            you see an advertisement.
          </p>
          <table className="w-full border-collapse border border-gray-300 mt-4 mb-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 p-2 text-left">Cookie Name</th>
                <th className="border border-gray-300 p-2 text-left">Purpose</th>
                <th className="border border-gray-300 p-2 text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2">marketing_id</td>
                <td className="border border-gray-300 p-2">Track marketing campaign effectiveness</td>
                <td className="border border-gray-300 p-2">90 days</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">referral_source</td>
                <td className="border border-gray-300 p-2">Track referral and affiliate programs</td>
                <td className="border border-gray-300 p-2">30 days</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="third-party-cookies">
        <h2>5. Third-Party Cookies</h2>
        <p>
          Some cookies on our website are placed by third-party services. 
          We use these services to enhance functionality and analyze usage.
        </p>

        <div id="google-analytics">
          <h3>5.1 Google Analytics</h3>
          <p>
            We use Google Analytics to understand how users interact with our website. 
            Google Analytics uses cookies to collect information such as:
          </p>
          <ul>
            <li>Pages visited and time spent on each page</li>
            <li>User behavior patterns and navigation paths</li>
            <li>Traffic sources and referral information</li>
            <li>Device and browser information</li>
          </ul>
          <p>
            This information is processed in an anonymous form and helps us improve our service.
            You can opt-out of Google Analytics tracking by installing the 
            <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              Google Analytics Opt-out Browser Add-on
            </a>.
          </p>
        </div>

        <div id="stripe-payments">
          <h3>5.2 Stripe Payments</h3>
          <p>
            We use Stripe to process payments securely. Stripe may use cookies to:
          </p>
          <ul>
            <li>Prevent fraud and ensure payment security</li>
            <li>Remember payment preferences</li>
            <li>Provide seamless checkout experience</li>
          </ul>
          <p>
            For more information, see 
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              Stripe's Privacy Policy
            </a>.
          </p>
        </div>

        <div id="social-media">
          <h3>5.3 Social Media Integration</h3>
          <p>
            Our website may include social media features and widgets. 
            These features may collect information about your visits and may set cookies 
            to enable proper functionality.
          </p>
          <p>
            Social media platforms covered include:
          </p>
          <ul>
            <li>Google (for OAuth authentication)</li>
            <li>Twitter (for sharing features)</li>
            <li>Other integrated social platforms</li>
          </ul>
        </div>
      </section>

      <section id="cookie-duration">
        <h2>6. Cookie Duration</h2>
        <p>
          Cookies have different lifespans:
        </p>
        <ul>
          <li>
            <strong>Session Cookies:</strong> Deleted when you close your browser
          </li>
          <li>
            <strong>Persistent Cookies:</strong> Remain on your device for a set period or until manually deleted
          </li>
        </ul>
        <p>
          In accordance with EU ePrivacy Directive, persistent cookies on our website 
          do not last longer than 12 months, with most lasting significantly shorter periods.
        </p>
      </section>

      <section id="managing-cookies">
        <h2>7. Managing Your Cookie Preferences</h2>
        <p>
          You have several options for managing cookies:
        </p>

        <div id="browser-settings">
          <h3>7.1 Browser Settings</h3>
          <p>
            Most browsers allow you to control cookies through their settings. 
            You can usually find these options in the "Privacy" or "Security" section of your browser.
          </p>
          <p>Browser-specific instructions:</p>
          <ul>
            <li>
              <strong>Chrome:</strong> Settings → Privacy and Security → Cookies and other site data
            </li>
            <li>
              <strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data
            </li>
            <li>
              <strong>Safari:</strong> Preferences → Privacy → Manage Website Data
            </li>
            <li>
              <strong>Edge:</strong> Settings → Cookies and site permissions → Cookies and site data
            </li>
          </ul>
          <p>
            <strong>Note:</strong> Disabling all cookies may affect website functionality 
            and your user experience.
          </p>
        </div>

        <div id="opt-out-tools">
          <h3>7.2 Opt-Out Tools</h3>
          <p>
            You can opt-out of specific tracking services:
          </p>
          <ul>
            <li>
              <strong>Google Analytics:</strong> 
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">
                Browser Add-on
              </a>
            </li>
            <li>
              <strong>Do Not Track:</strong> Enable "Do Not Track" in your browser settings
            </li>
            <li>
              <strong>Ad Choices:</strong> Visit 
              <a href="http://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">
                Digital Advertising Alliance
              </a>
            </li>
          </ul>
        </div>
      </section>

      <section id="consent-management">
        <h2>8. Consent Management</h2>
        <p>
          When you first visit our website, you'll see a cookie consent banner 
          that allows you to:
        </p>
        <ul>
          <li>Accept all cookies</li>
          <li>Reject non-essential cookies</li>
          <li>Customize your cookie preferences by category</li>
        </ul>
        <p>
          You can change your consent preferences at any time by:
        </p>
        <ul>
          <li>Clicking the "Cookie Preferences" link in our website footer</li>
          <li>Accessing cookie settings in your account dashboard</li>
          <li>Contacting us directly</li>
        </ul>
        <p>
          <strong>GDPR Compliance:</strong> Your consent is freely given, specific, 
          informed, and unambiguous. You can withdraw consent at any time without 
          affecting the lawfulness of processing based on consent before its withdrawal.
        </p>
      </section>

      <section id="your-rights">
        <h2>9. Your Rights</h2>
        <p>
          Under applicable data protection laws (GDPR, CCPA), you have rights regarding cookies:
        </p>
        <ul>
          <li><strong>Right to Information:</strong> Know what cookies we use and why</li>
          <li><strong>Right to Consent:</strong> Choose which cookies to accept</li>
          <li><strong>Right to Withdraw:</strong> Change or withdraw consent at any time</li>
          <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
          <li><strong>Right to Access:</strong> Request information about cookies affecting you</li>
        </ul>
        <p>
          To exercise these rights, please contact us at privacy@veo3video.me.
        </p>
      </section>

      <section id="policy-updates">
        <h2>10. Policy Updates</h2>
        <p>
          We may update this Cookie Policy periodically to reflect:
        </p>
        <ul>
          <li>Changes in our cookie usage</li>
          <li>New features or services</li>
          <li>Legal or regulatory requirements</li>
          <li>Best practice improvements</li>
        </ul>
        <p>
          We will notify you of significant changes by:
        </p>
        <ul>
          <li>Email notification to registered users</li>
          <li>Prominent notice on our website</li>
          <li>Updated consent banner when appropriate</li>
        </ul>
        <p>
          We recommend reviewing this policy periodically to stay informed 
          about our cookie practices.
        </p>
      </section>

      <section id="contact">
        <h2>11. Contact Information</h2>
        <p>
          If you have questions about this Cookie Policy or our cookie practices, 
          please contact us:
        </p>
        <ul>
          <li><strong>Email:</strong> privacy@veo3video.me</li>
          <li><strong>Cookie Questions:</strong> cookies@veo3video.me</li>
          <li><strong>Website:</strong> https://veo3video.me</li>
          <li><strong>Data Protection Officer:</strong> dpo@veo3video.me</li>
        </ul>
        <p>
          We will respond to your inquiries within 30 days in accordance with applicable law.
        </p>
      </section>
    </LegalPageLayout>
  )
}