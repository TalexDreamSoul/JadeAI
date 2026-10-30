import { ArrowLeft, Mail } from 'lucide-react';
import { Link } from '@/i18n/routing';

type LegalDocumentKind = 'privacy' | 'terms';

interface LegalSection {
  title: string;
  paragraphs: string[];
  items?: string[];
}

interface LegalCopy {
  title: string;
  summary: string;
  back: string;
  updated: string;
  contact: string;
  sections: LegalSection[];
}

const zhCopy: Record<LegalDocumentKind, Omit<LegalCopy, 'contact'>> = {
  privacy: {
    title: '隐私政策',
    summary: '本政策说明 JadeAI 如何收集、使用、存储和保护你在使用简历与求职服务时提供的信息。',
    back: '返回首页',
    updated: '生效日期：2026 年 8 月 23 日',
    sections: [
      {
        title: '我们收集的信息',
        paragraphs: ['我们仅收集提供服务所必需的信息。'],
        items: [
          '账号信息，例如邮箱、昵称、登录方式和必要的安全记录。',
          '你主动创建或导入的简历、职位描述、面试回答、投递记录和相关附件。',
          '功能使用、错误、设备和网络信息，用于安全防护、故障诊断与产品改进。',
          '订单、权益和支付状态。完整银行卡或第三方支付账户凭据由支付服务商处理。',
        ],
      },
      {
        title: '我们如何使用信息',
        paragraphs: ['我们使用这些信息来提供简历编辑、AI 分析、导出、分享、模拟面试、订单履约、客户支持和安全保障。未经你的明确授权，我们不会出售你的个人信息，也不会将你的简历用于面向其他客户的广告画像。'],
      },
      {
        title: 'AI 与第三方服务',
        paragraphs: ['当你使用 AI 功能时，完成请求所需的提示词和相关简历片段可能会发送给管理员配置的 AI 服务商。文件也可能由管理员配置的对象存储服务处理。我们要求这些服务商仅按指令处理数据，但其处理仍受各自政策约束。请勿输入与求职无关的敏感个人信息。'],
      },
      {
        title: '共享、保存与删除',
        paragraphs: ['我们仅在履行服务、遵守法律、处理安全事件或取得你同意的情况下共享信息。数据会在账号存续、履行合同和法定义务所需期间保存。你可以删除简历、投递记录或账号；因备份、审计和争议处理需要，删除可能存在合理延迟。公开分享链接由你控制，关闭后将不再向新的访问请求提供内容。'],
      },
      {
        title: '安全措施',
        paragraphs: ['我们采用访问控制、传输加密、密钥保护、操作审计、备份和安全监测降低风险。任何系统都无法保证绝对安全；发生可能影响你权益的安全事件时，我们会按适用法律采取补救和通知措施。'],
      },
      {
        title: '你的权利',
        paragraphs: ['你可以请求访问、更正、导出或删除个人信息，也可以撤回非必要处理的同意。为防止未经授权的操作，我们可能需要验证身份。若法律规定了例外，我们会说明无法执行请求的原因。'],
      },
      {
        title: '未成年人',
        paragraphs: ['JadeAI 面向具备求职和订立服务协议能力的用户。未达到所在地法定年龄的用户应在监护人同意和指导下使用。'],
      },
      {
        title: '政策更新',
        paragraphs: ['当服务或法律要求发生重大变化时，我们会更新本政策，并通过页面提示或其他合理方式告知。重大变更不会追溯削减你已享有的法定权利。'],
      },
    ],
  },
  terms: {
    title: '服务条款',
    summary: '本条款约定你与 JadeAI 运营方之间关于账号、AI 求职服务、内容、付费和责任的权利义务。',
    back: '返回首页',
    updated: '生效日期：2026 年 8 月 23 日',
    sections: [
      {
        title: '服务范围',
        paragraphs: ['JadeAI 提供简历创建与编辑、职位分析、专项简历、导出分享、模拟面试、求职记录及相关 AI 辅助能力。具体功能、额度和价格以购买或使用时页面展示为准。'],
      },
      {
        title: '账号与安全',
        paragraphs: ['你应提供真实、合法的信息并妥善保管账号凭据。不得共享、出售账号或绕过访问控制。发现未经授权使用时，请立即联系我们。你对账号下经有效认证完成的操作负责，但因平台安全缺陷造成的除外。'],
      },
      {
        title: '用户内容与授权',
        paragraphs: ['你保留上传内容的权利，并确认有权处理其中涉及的个人信息和知识产权。你授予我们一项仅为提供、维护和改进服务所必需的有限许可。删除内容后，该许可在合理备份和法定义务范围外终止。'],
      },
      {
        title: 'AI 输出',
        paragraphs: ['AI 输出可能不准确、不完整或与他人相似，不构成录用承诺、职业、法律或财务意见。你应在投递前核验事实并作出最终决定，不得使用 AI 生成虚假经历、资质或侵权内容。'],
      },
      {
        title: '付费、续费与退款',
        paragraphs: ['付费项目的价格、币种、期限、权益和是否自动续费以确认订单时为准。除法律另有规定或页面明确承诺外，已交付的数字内容和已消耗的 AI 额度通常不支持退款；未履约、重复扣款或服务故障导致无法使用的，可申请核验和退款。任何自动续费都会在购买前单独说明，并提供取消方式。'],
      },
      {
        title: '禁止行为',
        paragraphs: ['你不得攻击或干扰服务、批量抓取他人数据、绕过额度和支付、传播恶意代码、侵犯他人权利，或使用服务从事违法、欺诈和歧视行为。'],
      },
      {
        title: '服务变更与终止',
        paragraphs: ['我们可能为安全、合规和产品维护调整功能。涉及已购核心权益的重大不利变更，将提供合理通知或补救。严重违反条款、安全风险或法律要求下，我们可以限制或终止账号，并保留你依法申诉和导出数据的权利。'],
      },
      {
        title: '责任边界',
        paragraphs: ['我们会以合理的专业注意提供服务，但不保证 AI 输出、求职结果或服务永不中断。法律允许范围内，双方对间接损失承担的责任受限制；因故意或重大过失、个人信息侵害以及法律不得排除的责任不受该限制。'],
      },
      {
        title: '条款更新与争议',
        paragraphs: ['重大条款变更会提前以合理方式通知。争议发生时，双方应先通过联系渠道协商；协商不成的，按照运营者所在地和适用法律规定处理。'],
      },
    ],
  },
};

const enCopy: Record<LegalDocumentKind, Omit<LegalCopy, 'contact'>> = {
  privacy: {
    title: 'Privacy Policy',
    summary: 'This policy explains how JadeAI collects, uses, stores, and protects information used by its resume and career services.',
    back: 'Back to home',
    updated: 'Effective: August 23, 2026',
    sections: [
      {
        title: 'Information we collect',
        paragraphs: ['We collect only the information needed to provide and secure the service.'],
        items: [
          'Account details such as email, display name, sign-in method, and necessary security records.',
          'Resumes, job descriptions, interview answers, application records, and files you choose to provide.',
          'Usage, error, device, and network data used for security, diagnostics, and product improvement.',
          'Order, entitlement, and payment status. Payment providers process full card or payment-account credentials.',
        ],
      },
      {
        title: 'How we use information',
        paragraphs: ['We use information to provide editing, AI analysis, exports, sharing, mock interviews, order fulfillment, support, and security. We do not sell personal information or use resume content to build advertising profiles for other customers without explicit consent.'],
      },
      {
        title: 'AI and service providers',
        paragraphs: ['When you use AI features, the prompt and relevant resume excerpts may be sent to the AI provider configured by the operator. Files may also be handled by a configured storage provider. These providers are instructed to process data only to deliver the requested service and remain subject to their own policies.'],
      },
      {
        title: 'Sharing, retention, and deletion',
        paragraphs: ['We share information only to operate the service, comply with law, address security incidents, or with your consent. Data is retained while your account is active and as needed for contractual and legal duties. You can delete resumes, application records, or your account; backups, audits, and dispute handling may cause a reasonable delay.'],
      },
      {
        title: 'Security',
        paragraphs: ['We use access controls, encryption in transit, secret protection, audit records, backups, and monitoring to reduce risk. No system is perfectly secure. If an incident may materially affect your rights, we will take remedial and notification steps required by applicable law.'],
      },
      {
        title: 'Your rights',
        paragraphs: ['You may request access, correction, export, or deletion of personal information and withdraw consent for optional processing. We may verify identity before acting on a request and will explain any legal exception that prevents completion.'],
      },
      {
        title: 'Children',
        paragraphs: ['JadeAI is intended for people able to seek work and enter a service agreement. Users below the legal age in their location must use it with a guardian’s consent and supervision.'],
      },
      {
        title: 'Policy updates',
        paragraphs: ['We will update this policy when the service or legal requirements materially change and provide notice through the product or another reasonable channel.'],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    summary: 'These terms govern accounts, AI career services, user content, payments, and responsibilities between you and the JadeAI operator.',
    back: 'Back to home',
    updated: 'Effective: August 23, 2026',
    sections: [
      {
        title: 'Service scope',
        paragraphs: ['JadeAI provides resume creation and editing, job analysis, tailored resumes, exports and sharing, mock interviews, application tracking, and related AI assistance. Available features, quotas, and prices are those shown when you use or purchase them.'],
      },
      {
        title: 'Accounts and security',
        paragraphs: ['Provide lawful information and protect your credentials. You may not sell or share accounts or bypass access controls. Notify us promptly of unauthorized use.'],
      },
      {
        title: 'Your content',
        paragraphs: ['You retain your rights in uploaded content and confirm you may process the personal data and intellectual property it contains. You grant us only the limited permission necessary to operate and maintain the service.'],
      },
      {
        title: 'AI output',
        paragraphs: ['AI output may be inaccurate, incomplete, or similar to output produced for others. It is not a promise of employment or professional legal, financial, or career advice. Verify facts before submitting anything and do not fabricate experience or qualifications.'],
      },
      {
        title: 'Payments and refunds',
        paragraphs: ['Price, currency, duration, entitlements, and renewal terms are shown at checkout. Unless law or the offer states otherwise, delivered digital content and consumed AI credits are generally non-refundable. Undelivered services, duplicate charges, and verified outages may qualify for a refund. Any recurring charge will be disclosed separately before purchase.'],
      },
      {
        title: 'Prohibited use',
        paragraphs: ['Do not attack the service, scrape other users’ data, evade quotas or payments, distribute malicious code, infringe rights, or use JadeAI for unlawful, fraudulent, or discriminatory conduct.'],
      },
      {
        title: 'Changes and termination',
        paragraphs: ['We may adjust features for security, compliance, and maintenance. Material adverse changes to paid core entitlements will receive reasonable notice or remediation. Serious violations, security threats, or legal requirements may result in restrictions or termination.'],
      },
      {
        title: 'Liability',
        paragraphs: ['We use reasonable professional care but do not guarantee AI output, employment outcomes, or uninterrupted operation. Liability for indirect losses is limited where law permits; liability that cannot legally be excluded remains unaffected.'],
      },
      {
        title: 'Updates and disputes',
        paragraphs: ['We will provide reasonable notice of material changes. The parties should first try to resolve disputes through the contact channel before using remedies available under applicable law.'],
      },
    ],
  },
};

export function LegalDocument({ kind, locale }: { kind: LegalDocumentKind; locale: string }) {
  const base = locale === 'en' ? enCopy[kind] : zhCopy[kind];
  const contactEmail = process.env.LEGAL_CONTACT_EMAIL || 'privacy@tagzxia.com';
  const operatorName = process.env.LEGAL_OPERATOR_NAME || 'JadeAI';
  const copy: LegalCopy = {
    ...base,
    contact: locale === 'en'
      ? `Operator: ${operatorName}. Privacy and service requests: ${contactEmail}`
      : `运营者：${operatorName}。隐私与服务请求邮箱：${contactEmail}`,
  };

  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          {copy.back}
        </Link>

        <header className="mt-10 border-b border-zinc-200 pb-8 dark:border-zinc-800">
          <h1 className="text-3xl font-semibold sm:text-4xl">{copy.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">{copy.summary}</p>
          <p className="mt-4 text-sm text-zinc-500">{copy.updated}</p>
        </header>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {copy.sections.map((section) => (
            <section key={section.title} className="py-8">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-[15px] leading-7 text-zinc-600 dark:text-zinc-300">{paragraph}</p>
              ))}
              {section.items && (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-zinc-600 dark:text-zinc-300">
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        <footer className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <p className="flex items-start gap-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            {copy.contact}
          </p>
        </footer>
      </div>
    </main>
  );
}
