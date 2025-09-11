// import React from 'react' // unused
import { useTranslation } from 'react-i18next'
import { LegalPageLayout } from './LegalPageLayout'

export default function TermsOfServicePage() {
  const { t } = useTranslation()

  const tableOfContents = [
    { id: 'acceptance', title: 'Acceptance of Terms', level: 1 },
    { id: 'service-description', title: 'Service Description', level: 1 },
    { id: 'account-registration', title: 'Account Registration', level: 1 },
    { id: 'user-responsibilities', title: 'User Responsibilities', level: 2 },
    { id: 'account-security', title: 'Account Security', level: 2 },
    { id: 'subscription-and-payment', title: 'Subscription and Payment', level: 1 },
    { id: 'subscription-plans', title: 'Subscription Plans', level: 2 },
    { id: 'billing-and-charges', title: 'Billing and Charges', level: 2 },
    { id: 'refunds-and-cancellation', title: 'Refunds and Cancellation', level: 2 },
    { id: 'acceptable-use', title: 'Acceptable Use Policy', level: 1 },
    { id: 'prohibited-activities', title: 'Prohibited Activities', level: 2 },
    { id: 'content-guidelines', title: 'Content Guidelines', level: 2 },
    { id: 'intellectual-property', title: 'Intellectual Property', level: 1 },
    { id: 'our-ip', title: 'Our Intellectual Property', level: 2 },
    { id: 'user-content', title: 'User-Generated Content', level: 2 },
    { id: 'service-availability', title: 'Service Availability', level: 1 },
    { id: 'termination', title: 'Termination', level: 1 },
    { id: 'termination-by-us', title: 'Termination by Us', level: 2 },
    { id: 'termination-by-user', title: 'Termination by User', level: 2 },
    { id: 'disclaimers', title: 'Disclaimers', level: 1 },
    { id: 'limitation-of-liability', title: 'Limitation of Liability', level: 1 },
    { id: 'indemnification', title: 'Indemnification', level: 1 },
    { id: 'dispute-resolution', title: 'Dispute Resolution', level: 1 },
    { id: 'governing-law', title: 'Governing Law', level: 1 },
    { id: 'changes-to-terms', title: 'Changes to Terms', level: 1 },
    { id: 'contact-information', title: 'Contact Information', level: 1 },
  ]

  return (
    <LegalPageLayout
      title={t('legal.termsOfService.title')}
      lastUpdated="January 29, 2025"
      tableOfContents={tableOfContents}
      pageType="termsOfService"
    >
      <section id="acceptance">
        <h2>1. Acceptance of Terms</h2>
        <p>
          Welcome to Veo3Video.me ("Service," "we," "us," or "our"). These Terms of Service 
          ("Terms") govern your use of our AI-powered video generation platform and services.
        </p>
        <p>
          By accessing or using our Service, you agree to be bound by these Terms. 
          If you disagree with any part of these Terms, you may not access the Service.
        </p>
        <p>
          These Terms constitute a legally binding agreement between you and Veo3Video.me. 
          Please read them carefully before using our Service.
        </p>
      </section>

      <section id="service-description">
        <h2>2. Service Description</h2>
        <p>
          Veo3Video.me provides an AI-powered video generation platform that allows users to:
        </p>
        <ul>
          <li>Create videos using pre-designed templates</li>
          <li>Generate custom AI videos with various parameters</li>
          <li>Access a library of trending video templates</li>
          <li>Manage and download created videos</li>
          <li>Share videos and collaborate with other users</li>
        </ul>
        <p>
          Our Service utilizes advanced AI technologies, including Google Veo3 API, 
          to generate high-quality videos based on user inputs and preferences.
        </p>
      </section>

      <section id="account-registration">
        <h2>3. Account Registration</h2>
        <p>
          To use our Service, you must create an account by providing accurate and 
          complete information. You may register using:
        </p>
        <ul>
          <li>Email and password</li>
          <li>Google OAuth authentication</li>
          <li>Other supported authentication methods</li>
        </ul>

        <div id="user-responsibilities">
          <h3>3.1 User Responsibilities</h3>
          <p>You are responsible for:</p>
          <ul>
            <li>Providing accurate, current, and complete account information</li>
            <li>Maintaining the accuracy of your account information</li>
            <li>Complying with all applicable laws and regulations</li>
            <li>Respecting the rights of other users and third parties</li>
          </ul>
        </div>

        <div id="account-security">
          <h3>3.2 Account Security</h3>
          <p>You must:</p>
          <ul>
            <li>Keep your login credentials confidential</li>
            <li>Use a strong, unique password</li>
            <li>Notify us immediately of any unauthorized access</li>
            <li>Accept responsibility for all activities under your account</li>
          </ul>
        </div>
      </section>

      <section id="subscription-and-payment">
        <h2>4. Subscription and Payment</h2>

        <div id="subscription-plans">
          <h3>4.1 Subscription Plans</h3>
          <p>We offer several subscription tiers:</p>
          <ul>
            <li><strong>Free Plan:</strong> Limited features with basic video generation</li>
            <li><strong>Basic Plan ($9.99/month):</strong> 200 credits, standard quality</li>
            <li><strong>Pro Plan ($19.99/month):</strong> 1,500 credits, high quality</li>
            <li><strong>Enterprise Plan ($99.99/month):</strong> 6,000 credits, premium features</li>
          </ul>
        </div>

        <div id="billing-and-charges">
          <h3>4.2 Billing and Charges</h3>
          <ul>
            <li>Subscription fees are charged monthly in advance</li>
            <li>All payments are processed securely through Stripe</li>
            <li>Prices may change with 30 days' notice</li>
            <li>Failed payments may result in service suspension</li>
          </ul>
        </div>

        <div id="refunds-and-cancellation">
          <h3>4.3 Refunds and Cancellation</h3>
          <ul>
            <li>You may cancel your subscription at any time</li>
            <li>Cancellation takes effect at the end of the current billing cycle</li>
            <li>No refunds for partial months or unused credits</li>
            <li>Free trial cancellations do not incur charges</li>
          </ul>
        </div>
      </section>

      <section id="acceptable-use">
        <h2>5. Acceptable Use Policy</h2>

        <div id="prohibited-activities">
          <h3>5.1 Prohibited Activities</h3>
          <p>You may not use our Service to:</p>
          <ul>
            <li>Create illegal, harmful, or offensive content</li>
            <li>Violate intellectual property rights of others</li>
            <li>Engage in harassment, bullying, or discriminatory behavior</li>
            <li>Distribute malware, viruses, or harmful code</li>
            <li>Attempt to circumvent security measures</li>
            <li>Use automated tools to access the Service without permission</li>
            <li>Create content that promotes violence, hatred, or illegal activities</li>
            <li>Impersonate others or create false identities</li>
          </ul>
        </div>

        <div id="content-guidelines">
          <h3>5.2 Content Guidelines</h3>
          <p>All user-generated content must:</p>
          <ul>
            <li>Comply with applicable laws and regulations</li>
            <li>Respect intellectual property rights</li>
            <li>Be appropriate for a general audience</li>
            <li>Not contain personal information of others without consent</li>
            <li>Not promote harmful or dangerous activities</li>
          </ul>
        </div>
      </section>

      <section id="intellectual-property">
        <h2>6. Intellectual Property</h2>

        <div id="our-ip">
          <h3>6.1 Our Intellectual Property</h3>
          <p>
            The Service, including its original content, features, and functionality, 
            is owned by Veo3Video.me and is protected by international copyright, 
            trademark, patent, trade secret, and other intellectual property laws.
          </p>
          <p>You may not:</p>
          <ul>
            <li>Modify, copy, or distribute our proprietary content</li>
            <li>Reverse engineer or attempt to extract source code</li>
            <li>Use our trademarks without written permission</li>
            <li>Create derivative works based on our Service</li>
          </ul>
        </div>

        <div id="user-content">
          <h3>6.2 User-Generated Content</h3>
          <p>
            You retain ownership of content you create using our Service. 
            However, you grant us a limited license to:
          </p>
          <ul>
            <li>Host, store, and display your content</li>
            <li>Process and analyze content for service improvement</li>
            <li>Share content publicly if you choose to make it public</li>
            <li>Remove content that violates these Terms</li>
          </ul>
        </div>
      </section>

      <section id="service-availability">
        <h2>7. Service Availability</h2>
        <p>
          We strive to maintain high service availability but cannot guarantee 
          uninterrupted access. The Service may be unavailable due to:
        </p>
        <ul>
          <li>Scheduled maintenance and updates</li>
          <li>Technical issues or system failures</li>
          <li>Third-party service dependencies</li>
          <li>Force majeure events</li>
        </ul>
        <p>
          We will make reasonable efforts to provide advance notice of 
          planned maintenance whenever possible.
        </p>
      </section>

      <section id="termination">
        <h2>8. Termination</h2>

        <div id="termination-by-us">
          <h3>8.1 Termination by Us</h3>
          <p>We may terminate or suspend your account if you:</p>
          <ul>
            <li>Violate these Terms of Service</li>
            <li>Engage in fraudulent or illegal activities</li>
            <li>Abuse or misuse the Service</li>
            <li>Fail to pay required fees</li>
          </ul>
        </div>

        <div id="termination-by-user">
          <h3>8.2 Termination by User</h3>
          <p>
            You may terminate your account at any time by contacting us at 
            support@veo3video.me or through your account settings.
          </p>
          <p>Upon termination:</p>
          <ul>
            <li>Your access to the Service will cease</li>
            <li>Your content may be deleted after 30 days</li>
            <li>Outstanding fees remain due and payable</li>
            <li>These Terms continue to apply to past use</li>
          </ul>
        </div>
      </section>

      <section id="disclaimers">
        <h2>9. Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES 
          OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING:
        </p>
        <ul>
          <li>MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE</li>
          <li>NON-INFRINGEMENT OF THIRD-PARTY RIGHTS</li>
          <li>CONTINUOUS, UNINTERRUPTED, OR ERROR-FREE OPERATION</li>
          <li>ACCURACY OR RELIABILITY OF CONTENT OR INFORMATION</li>
        </ul>
        <p>
          Your use of the Service is at your own risk. We do not warrant that 
          the Service will meet your specific requirements or expectations.
        </p>
      </section>

      <section id="limitation-of-liability">
        <h2>10. Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR:
        </p>
        <ul>
          <li>INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES</li>
          <li>LOSS OF PROFITS, REVENUE, DATA, OR USE</li>
          <li>BUSINESS INTERRUPTION OR COST OF SUBSTITUTE SERVICES</li>
          <li>DAMAGES EXCEEDING THE AMOUNT PAID FOR THE SERVICE</li>
        </ul>
        <p>
          Some jurisdictions do not allow limitation of liability, so these 
          limitations may not apply to you.
        </p>
      </section>

      <section id="indemnification">
        <h2>11. Indemnification</h2>
        <p>
          You agree to indemnify and hold us harmless from any claims, damages, 
          losses, or expenses arising from:
        </p>
        <ul>
          <li>Your use of the Service</li>
          <li>Your violation of these Terms</li>
          <li>Your violation of any third-party rights</li>
          <li>Content you create or share using the Service</li>
        </ul>
      </section>

      <section id="dispute-resolution">
        <h2>12. Dispute Resolution</h2>
        <p>
          Most disputes can be resolved through direct communication. 
          Please contact us at legal@veo3video.me before pursuing legal action.
        </p>
        <p>
          If informal resolution is unsuccessful, disputes will be resolved through 
          binding arbitration in accordance with the rules of the American Arbitration Association.
        </p>
        <p>
          You waive your right to participate in class-action lawsuits or 
          class-wide arbitrations against us.
        </p>
      </section>

      <section id="governing-law">
        <h2>13. Governing Law</h2>
        <p>
          These Terms are governed by and construed in accordance with the laws 
          of the State of California, without regard to conflict of law principles.
        </p>
        <p>
          Any legal action or proceeding shall be brought exclusively in the 
          federal or state courts located in San Francisco County, California.
        </p>
      </section>

      <section id="changes-to-terms">
        <h2>14. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms at any time. 
          We will notify you of significant changes by:
        </p>
        <ul>
          <li>Email notification to registered users</li>
          <li>Prominent notice on our website</li>
          <li>In-app notifications</li>
        </ul>
        <p>
          Your continued use of the Service after changes constitutes 
          acceptance of the modified Terms.
        </p>
      </section>

      <section id="contact-information">
        <h2>15. Contact Information</h2>
        <p>
          For questions about these Terms of Service, please contact us:
        </p>
        <ul>
          <li><strong>Email:</strong> legal@veo3video.me</li>
          <li><strong>Support:</strong> support@veo3video.me</li>
          <li><strong>Website:</strong> https://veo3video.me</li>
        </ul>
        <p>
          By using our Service, you acknowledge that you have read, understood, 
          and agree to be bound by these Terms of Service.
        </p>
      </section>
    </LegalPageLayout>
  )
}