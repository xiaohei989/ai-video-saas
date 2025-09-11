// import React from 'react' // unused
import { useTranslation } from 'react-i18next'
import { LegalPageLayout } from './LegalPageLayout'

export default function PrivacyPolicyPage() {
  const { t } = useTranslation()

  const tableOfContents = [
    { id: 'overview', title: 'Overview', level: 1 },
    { id: 'information-we-collect', title: 'Information We Collect', level: 1 },
    { id: 'personal-information', title: 'Personal Information', level: 2 },
    { id: 'usage-data', title: 'Usage Data', level: 2 },
    { id: 'technical-data', title: 'Technical Data', level: 2 },
    { id: 'how-we-use', title: 'How We Use Your Information', level: 1 },
    { id: 'service-provision', title: 'Service Provision', level: 2 },
    { id: 'improvement', title: 'Service Improvement', level: 2 },
    { id: 'communication', title: 'Communication', level: 2 },
    { id: 'legal-basis', title: 'Legal Basis for Processing', level: 1 },
    { id: 'sharing', title: 'Information Sharing', level: 1 },
    { id: 'third-party-services', title: 'Third-Party Services', level: 2 },
    { id: 'legal-requirements', title: 'Legal Requirements', level: 2 },
    { id: 'data-retention', title: 'Data Retention', level: 1 },
    { id: 'your-rights', title: 'Your Rights', level: 1 },
    { id: 'gdpr-rights', title: 'GDPR Rights', level: 2 },
    { id: 'ccpa-rights', title: 'CCPA Rights', level: 2 },
    { id: 'data-security', title: 'Data Security', level: 1 },
    { id: 'international-transfers', title: 'International Data Transfers', level: 1 },
    { id: 'children-privacy', title: 'Children\'s Privacy', level: 1 },
    { id: 'policy-updates', title: 'Policy Updates', level: 1 },
    { id: 'contact', title: 'Contact Information', level: 1 },
  ]

  return (
    <LegalPageLayout
      title={t('legal.privacyPolicy.title')}
      lastUpdated="January 29, 2025"
      tableOfContents={tableOfContents}
      pageType="privacyPolicy"
    >
      <section id="overview">
        <h2>1. Overview</h2>
        <p>
          Welcome to Veo3Video.me ("we," "us," or "our"). This Privacy Policy explains how we collect, 
          use, disclose, and safeguard your information when you visit our website and use our 
          AI-powered video generation service.
        </p>
        <p>
          We are committed to protecting your privacy and ensuring transparency about our data 
          practices. This policy applies to all users of our platform and complies with applicable 
          data protection laws, including the General Data Protection Regulation (GDPR) and the 
          California Consumer Privacy Act (CCPA).
        </p>
      </section>

      <section id="information-we-collect">
        <h2>2. Information We Collect</h2>
        <p>
          We collect information to provide and improve our services. The types of information 
          we collect include:
        </p>

        <div id="personal-information">
          <h3>2.1 Personal Information</h3>
          <p>Information that can identify you personally, including:</p>
          <ul>
            <li><strong>Account Information:</strong> Name, email address, username, password</li>
            <li><strong>Profile Data:</strong> Profile picture, bio, website links, social media profiles</li>
            <li><strong>Payment Information:</strong> Credit card details, billing address (processed securely through Stripe)</li>
            <li><strong>Communication Data:</strong> Messages you send to us, support tickets, feedback</li>
          </ul>
        </div>

        <div id="usage-data">
          <h3>2.2 Usage Data</h3>
          <p>Information about how you use our service, including:</p>
          <ul>
            <li>Videos created, templates used, generation history</li>
            <li>Features accessed, time spent on platform</li>
            <li>Interaction patterns, click-through rates</li>
            <li>Content preferences and settings</li>
          </ul>
        </div>

        <div id="technical-data">
          <h3>2.3 Technical Data</h3>
          <p>Information collected automatically, including:</p>
          <ul>
            <li>IP address, device information, browser type and version</li>
            <li>Operating system, screen resolution, time zone</li>
            <li>Cookies and similar tracking technologies</li>
            <li>Log files, error reports, performance data</li>
          </ul>
        </div>
      </section>

      <section id="how-we-use">
        <h2>3. How We Use Your Information</h2>
        <p>We use your information for the following purposes:</p>

        <div id="service-provision">
          <h3>3.1 Service Provision</h3>
          <ul>
            <li>Create and manage your account</li>
            <li>Process video generation requests</li>
            <li>Provide customer support and technical assistance</li>
            <li>Process payments and manage subscriptions</li>
          </ul>
        </div>

        <div id="improvement">
          <h3>3.2 Service Improvement</h3>
          <ul>
            <li>Analyze usage patterns to improve our platform</li>
            <li>Develop new features and functionalities</li>
            <li>Conduct research and analytics</li>
            <li>Monitor and improve system performance</li>
          </ul>
        </div>

        <div id="communication">
          <h3>3.3 Communication</h3>
          <ul>
            <li>Send important service updates and notifications</li>
            <li>Respond to your inquiries and requests</li>
            <li>Send promotional materials (with your consent)</li>
            <li>Conduct surveys and collect feedback</li>
          </ul>
        </div>
      </section>

      <section id="legal-basis">
        <h2>4. Legal Basis for Processing (GDPR)</h2>
        <p>Under GDPR, we process your personal data based on the following legal grounds:</p>
        <ul>
          <li><strong>Contract Performance:</strong> To provide services you've requested</li>
          <li><strong>Legitimate Interests:</strong> To improve our services and prevent fraud</li>
          <li><strong>Legal Compliance:</strong> To comply with applicable laws and regulations</li>
          <li><strong>Consent:</strong> For marketing communications and non-essential cookies</li>
        </ul>
      </section>

      <section id="sharing">
        <h2>5. Information Sharing</h2>
        <p>We do not sell, trade, or rent your personal information. We may share information in the following circumstances:</p>

        <div id="third-party-services">
          <h3>5.1 Third-Party Service Providers</h3>
          <ul>
            <li><strong>Google Veo3 API:</strong> For video generation (processed data only)</li>
            <li><strong>Stripe:</strong> For payment processing</li>
            <li><strong>Supabase:</strong> For database and authentication services</li>
            <li><strong>Analytics Providers:</strong> For usage analytics (anonymized data)</li>
          </ul>
        </div>

        <div id="legal-requirements">
          <h3>5.2 Legal Requirements</h3>
          <p>We may disclose information when required by law or to:</p>
          <ul>
            <li>Comply with legal processes, court orders, or government requests</li>
            <li>Protect our rights, property, or safety</li>
            <li>Prevent fraud or illegal activities</li>
            <li>Enforce our Terms of Service</li>
          </ul>
        </div>
      </section>

      <section id="data-retention">
        <h2>6. Data Retention</h2>
        <p>We retain your information for as long as necessary to:</p>
        <ul>
          <li>Provide our services to you</li>
          <li>Comply with legal obligations</li>
          <li>Resolve disputes and enforce agreements</li>
          <li>Support business operations and analytics</li>
        </ul>
        <p>
          Specific retention periods:
        </p>
        <ul>
          <li><strong>Account Data:</strong> Until account deletion + 30 days</li>
          <li><strong>Video Content:</strong> Until deletion by user or account closure</li>
          <li><strong>Payment Records:</strong> 7 years for tax and legal compliance</li>
          <li><strong>Analytics Data:</strong> 2 years in anonymized form</li>
        </ul>
      </section>

      <section id="your-rights">
        <h2>7. Your Rights</h2>
        
        <div id="gdpr-rights">
          <h3>7.1 GDPR Rights (EU Users)</h3>
          <p>Under GDPR, you have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request copies of your personal data</li>
            <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
            <li><strong>Erasure:</strong> Request deletion of your personal data</li>
            <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
            <li><strong>Restriction:</strong> Limit processing of your data</li>
            <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
            <li><strong>Withdraw Consent:</strong> For consent-based processing</li>
          </ul>
        </div>

        <div id="ccpa-rights">
          <h3>7.2 CCPA Rights (California Users)</h3>
          <p>Under CCPA, you have the right to:</p>
          <ul>
            <li>Know what personal information is collected</li>
            <li>Delete personal information</li>
            <li>Opt-out of the sale of personal information</li>
            <li>Non-discrimination for exercising privacy rights</li>
          </ul>
        </div>

        <p>
          To exercise these rights, please contact us at privacy@veo3video.me. 
          We will respond within 30 days.
        </p>
      </section>

      <section id="data-security">
        <h2>8. Data Security</h2>
        <p>We implement appropriate security measures to protect your information:</p>
        <ul>
          <li><strong>Encryption:</strong> Data encrypted in transit (TLS) and at rest</li>
          <li><strong>Access Control:</strong> Limited access on a need-to-know basis</li>
          <li><strong>Regular Audits:</strong> Security assessments and vulnerability testing</li>
          <li><strong>Secure Infrastructure:</strong> Industry-standard cloud security</li>
          <li><strong>Employee Training:</strong> Regular privacy and security training</li>
        </ul>
        <p>
          However, no method of transmission over the internet is 100% secure. 
          While we strive to protect your information, we cannot guarantee absolute security.
        </p>
      </section>

      <section id="international-transfers">
        <h2>9. International Data Transfers</h2>
        <p>
          Your information may be processed in countries other than your own. 
          We ensure adequate protection through:
        </p>
        <ul>
          <li>Standard Contractual Clauses approved by the European Commission</li>
          <li>Adequacy decisions for certain countries</li>
          <li>Other appropriate safeguards as required by law</li>
        </ul>
      </section>

      <section id="children-privacy">
        <h2>10. Children's Privacy</h2>
        <p>
          Our service is not intended for children under 13. We do not knowingly collect 
          personal information from children under 13. If we become aware that a child 
          under 13 has provided us with personal information, we will delete such information.
        </p>
        <p>
          For users between 13-16 in the EU, we require parental consent where legally required.
        </p>
      </section>

      <section id="policy-updates">
        <h2>11. Policy Updates</h2>
        <p>
          We may update this Privacy Policy periodically. We will notify you of significant 
          changes by:
        </p>
        <ul>
          <li>Email notification to registered users</li>
          <li>Prominent notice on our website</li>
          <li>In-app notifications</li>
        </ul>
        <p>
          Your continued use of our service after changes constitutes acceptance 
          of the updated policy.
        </p>
      </section>

      <section id="contact">
        <h2>12. Contact Information</h2>
        <p>
          For questions about this Privacy Policy or our privacy practices, contact us:
        </p>
        <ul>
          <li><strong>Email:</strong> privacy@veo3video.me</li>
          <li><strong>Legal Team:</strong> legal@veo3video.me</li>
          <li><strong>Website:</strong> https://veo3video.me</li>
          <li><strong>Data Protection Officer:</strong> dpo@veo3video.me (for GDPR inquiries)</li>
        </ul>
      </section>
    </LegalPageLayout>
  )
}