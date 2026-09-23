import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Redline HQ",
  description: "Privacy Policy for Redline HQ, a fire department readiness and operations platform.",
};

const sections = [
  {
    title: "Information We Collect",
    paragraphs: [
      "Redline HQ collects information needed to provide a fire department readiness and operations platform. Depending on how the service is used, this may include account information, department and member information, operational records, uploaded content, device information, and technical usage information.",
      "We collect information you provide directly, information entered by your department, and limited information generated when you use the service. We do not sell personal information.",
    ],
  },
  {
    title: "Account Information",
    paragraphs: [
      "Account information may include your name, email address, password credentials handled by our authentication provider, role, department affiliation, and account status. We use this information to authenticate you, provide access to the appropriate department workspace, communicate about the service, and protect accounts.",
    ],
  },
  {
    title: "Fire Department and Member Information",
    paragraphs: [
      "Departments may enter information about their organization, members, roles, contact details, certifications, qualifications, assignments, and readiness requirements. This information is controlled by the deploying department and is used to operate its Redline HQ workspace.",
    ],
  },
  {
    title: "Photos and User-Uploaded Content",
    paragraphs: [
      "Users and departments may upload photos, documents, inspection evidence, reports, and other content. Uploaded content may include images of apparatus, equipment, facilities, records, or other department materials. We process this content only to store it, display it to authorized users, and provide the requested service features.",
    ],
  },
  {
    title: "Operational and Readiness Data",
    paragraphs: [
      "Redline HQ may store training records, apparatus and readiness information, inventory and EMS supply records, maintenance records, inspection results, deficiencies, pre-plan information, certifications, documents, and reports. This data belongs to or is controlled by the deploying department and is used to provide department management, readiness, reporting, and operational workflows.",
    ],
  },
  {
    title: "How We Use Information",
    paragraphs: [
      "We use information to provide, maintain, secure, and improve Redline HQ; authenticate users; support department workflows; generate requested dashboards and reports; respond to support requests; communicate service updates; troubleshoot problems; prevent abuse; and comply with legal obligations.",
      "We may use aggregated or de-identified information for service analysis and improvement when it does not identify a person or department.",
    ],
  },
  {
    title: "How Information Is Shared",
    paragraphs: [
      "Information may be shared with authorized users within the relevant department according to that department's configuration and permissions. We may share information with service providers that host, secure, support, or operate parts of Redline HQ, subject to contractual or other appropriate protections.",
      "We may disclose information when required by law, legal process, or a valid governmental request, or when reasonably necessary to protect the rights, safety, and security of Redline HQ, our users, or others. We do not sell personal information or share it for third-party advertising.",
    ],
  },
  {
    title: "Data Storage and Security",
    paragraphs: [
      "Redline HQ uses access controls, authentication, department-level authorization, encrypted connections, and other reasonable administrative, technical, and organizational safeguards designed to protect information. No method of storage or transmission is completely secure, and we cannot guarantee absolute security.",
      "Data may be processed or stored by Redline HQ and its service providers in the locations where those providers operate. We select providers appropriate to the services they perform and expect them to protect information consistent with their obligations.",
    ],
  },
  {
    title: "Data Retention",
    paragraphs: [
      "We retain information for as long as needed to provide the service, maintain legitimate business and security records, resolve disputes, enforce agreements, and comply with legal obligations. Departments may request deletion of their deployment data, subject to applicable law, contractual requirements, backup cycles, and records we must retain for legitimate purposes.",
    ],
  },
  {
    title: "User and Deployment Department Responsibilities",
    paragraphs: [
      "Departments are responsible for determining what information they enter, maintaining accurate records, assigning appropriate roles and permissions, and ensuring that their use of Redline HQ complies with applicable law and department policy. Departments are also responsible for notifying members about their use of the service and responding to requests relating to department-controlled data.",
      "Users are responsible for protecting their credentials, using the service only as authorized, and promptly reporting suspected unauthorized access.",
    ],
  },
  {
    title: "Children's Privacy",
    paragraphs: [
      "Redline HQ is intended for fire department personnel and organizational users. It is not directed to children under 13, and we do not knowingly collect personal information directly from children under 13. If you believe a child has provided personal information to us, contact us so we can review and take appropriate action.",
    ],
  },
  {
    title: "Third-Party Services",
    paragraphs: [
      "Redline HQ relies on third-party services for functions such as authentication, hosting, storage, database operations, analytics, communications, and application delivery. Those providers may process information on our behalf under their own service terms and privacy practices. The service may also link to or interact with third-party services that are not controlled by Redline HQ.",
    ],
  },
  {
    title: "User Rights and Data Deletion Requests",
    paragraphs: [
      "Depending on your location and the role of your department, you may have rights to request access to, correction of, export of, or deletion of personal information. Requests involving department-controlled data may need to be made through the deploying department first.",
      "To submit a privacy or data deletion request, contact us at adam@redlinefirehq.com. We may need to verify your identity and authority before completing a request. We will respond consistent with applicable law and explain any limitation that applies.",
    ],
  },
  {
    title: "Changes to This Privacy Policy",
    paragraphs: [
      "We may update this Privacy Policy when our services, practices, or legal obligations change. We will post the updated policy at this URL and update the effective date. Your continued use of Redline HQ after an update means the revised policy applies to your use of the service, subject to applicable law.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#090a0b] text-white">
      <header className="border-b border-white/10 bg-[#090a0b]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="text-sm font-bold tracking-[0.18em]">
            REDLINE <span className="text-[#ed302f]">HQ</span>
          </Link>
          <Link href="/login" className="text-xs font-bold tracking-[0.12em] text-zinc-300 transition hover:text-white">
            FIREFIGHTER LOGIN
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-3xl border-b border-white/10 pb-10">
          <p className="mb-5 text-xs font-bold tracking-[0.28em] text-[#ff5956]">REDLINE HQ LLC</p>
          <h1 className="text-4xl font-bold tracking-[-0.04em] sm:text-6xl">Privacy Policy</h1>
          <p className="mt-6 text-base leading-7 text-zinc-400">Effective date: September 23, 2026</p>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
            This Privacy Policy explains how Redline HQ LLC collects, uses, shares, and protects information in connection with Redline HQ, our fire department readiness and operations SaaS and mobile application.
          </p>
        </div>

        <div className="divide-y divide-white/10">
          {sections.map((section) => (
            <section key={section.title} className="py-10 first:pt-12">
              <h2 className="text-2xl font-semibold tracking-tight text-white">{section.title}</h2>
              <div className="mt-5 max-w-3xl space-y-4 text-base leading-8 text-zinc-400">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>

        <section className="border-t border-white/10 pt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Contact Information</h2>
          <div className="mt-5 space-y-2 text-base leading-8 text-zinc-400">
            <p>Redline HQ LLC</p>
            <p><a className="text-zinc-200 underline decoration-[#ed302f] underline-offset-4" href="mailto:adam@redlinefirehq.com">adam@redlinefirehq.com</a></p>
            <p><a className="text-zinc-200 underline decoration-[#ed302f] underline-offset-4" href="https://redlinefirehq.com/">https://redlinefirehq.com/</a></p>
          </div>
        </section>
      </div>

      <footer className="border-t border-white/10 bg-[#111314]">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>REDLINE <span className="text-[#ed302f]">HQ</span></span>
          <Link href="/" className="transition hover:text-white">Back to Redline HQ</Link>
        </div>
      </footer>
    </main>
  );
}