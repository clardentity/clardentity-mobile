import { Bullets, DocLink, LegalPage, MailLink, P, Section, Strong } from "@/components/legal/legal";

const VERSION = "2026-10-17";
const UPDATED = "17 October 2026";
const CONTACT = "hello@clardentity.ai";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      version={VERSION}
      updated={UPDATED}
      intro={
        <>
          These terms are the agreement between you and Clardentity. They are written to be
          read, not to be scrolled past. By creating an account you accept them.
        </>
      }
    >
      <Section n={1} title="What Clardentity is">
        <P>
          Clardentity is an AI companion that answers questions in several modes and shows the
          evidence behind each claim it makes. It is a tool for thinking with, not a
          professional adviser.
        </P>
      </Section>

      <Section n={2} title="What it is not">
        <P>
          <Strong>Nothing Clardentity says is professional advice.</Strong> Not legal advice,
          not medical advice, not financial or investment advice, not tax advice, and not
          therapy. The Legal mode explains how rules generally work so you can talk to a lawyer
          better informed; it does not replace one. The Guidance mode is an AI companion for
          working towards a goal or thinking something through; it is not therapy, counselling
          or treatment, and it is not a crisis service. The Healthcare mode gives general
          health information and says which signs mean getting care urgently; it does not
          diagnose, prescribe or treat, and it does not replace a doctor, pharmacist or other
          clinician who can examine you.
        </P>
        <P>
          <Strong>
            If you are in crisis or someone is in danger, contact your local emergency
            services or a crisis line.
          </Strong>{" "}
          Clardentity cannot help with an emergency.
        </P>
        <P>
          Answers can be wrong. That is why every claim carries its sources and a confidence
          label, and why claims with nothing behind them say so. Check anything that matters
          before you act on it. Decisions you take are yours.
        </P>
      </Section>

      <Section n={3} title="Your account">
        <P>
          You must be at least 16 years old, give an accurate email address, and keep your
          password to yourself. You are responsible for what happens under your account. Tell us
          at <MailLink to={CONTACT} /> if you think someone else has got into it.
        </P>
      </Section>

      <Section n={4} title="What you may not do">
        <P>Do not use Clardentity to:</P>
        <Bullets
          items={[
            "break the law, or help anyone else to;",
            "produce material that sexualises children, incites violence, or harasses someone;",
            "build weapons, malware, or tools whose purpose is to harm;",
            "impersonate a person or organisation, or pass its answers off as a professional's;",
            "upload other people's personal data that you have no right to share;",
            "attack the service - scraping at volume, probing for holes, working around rate limits, or reselling access.",
          ]}
        />
        <P>
          We may suspend or close an account that does these things, and will say why unless the
          law prevents it.
        </P>
      </Section>

      <Section n={5} title="Your content and ours">
        <P>
          What you write and upload stays yours. You give us only the permission needed to run
          the service: to store it, process it, and send it to the providers listed in the{" "}
          <DocLink href="/privacy">Privacy Policy</DocLink> so that an answer can be produced. We
          do not use your conversations to train models, and we do not sell them.
        </P>
        <P>
          As between you and us, the answers Clardentity gives you are yours to use. The
          software, design and name are ours.
        </P>
      </Section>

      <Section n={6} title="Plans, previews and payment">
        <P>
          Some companions belong to paid plans. While billing is not yet in place, you may open
          them for testing from the plans dialog, subject to a daily message allowance. That
          access is a courtesy, not a contract: we may change the allowance, or close the
          preview, at any time. When paid plans open we will say what they cost before charging
          anything.
        </P>
      </Section>

      <Section n={7} title="Availability">
        <P>
          The service is provided as it is. We aim to keep it up and quick, but we do not promise
          uninterrupted availability, and we may change or remove features. Clardentity is still
          being built; parts of it will change.
        </P>
      </Section>

      <Section n={8} title="Liability">
        <P>
          To the fullest extent the law allows, we are not liable for indirect or consequential
          loss, lost profits, or loss of data, and our total liability for any claim is limited
          to the greater of the amount you paid us in the twelve months before it arose, or
          fifty US dollars.
        </P>
        <P>
          Nothing here limits liability that cannot lawfully be limited - including for death or
          personal injury caused by negligence, or for fraud. If you are a consumer, you keep
          the statutory rights your country gives you.
        </P>
      </Section>

      <Section n={9} title="Ending it">
        <P>
          You can delete your account at any time from your profile; everything under it goes
          with it. We may close an account that breaks section 4, or with reasonable notice if
          we stop offering the service.
        </P>
      </Section>

      <Section n={10} title="Changes to these terms">
        <P>
          If we change these terms materially we will raise the version number and ask you to
          accept the new version. Continuing to use the service after that point means you
          accept it.
        </P>
      </Section>

      <Section n={11} title="Law and contact">
        <P>
          These terms are governed by the laws of India, and the courts of Bengaluru have
          jurisdiction - except where the law of the country you live in gives you the right to
          bring a claim locally, which it may.
        </P>
        <P>
          <MailLink to={CONTACT} />
        </P>
      </Section>
    </LegalPage>
  );
}
