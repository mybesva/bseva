import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { CheckCircle2 } from "lucide-react";
import Layout from "@/components/Layout";
import { PortalSegmentedTabs } from "@/components/PortalSegmentedTabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DeleteAccountFlow from "@/components/account/DeleteAccountFlow";
import {
  InlineError,
  InlineNotice,
  OtpCodeInput,
  ResendCodeButton,
  otpErrorMessage,
  useOtpSender,
} from "@/components/account/OtpParts";
import {
  cancelDeletion,
  cancelDeletionRequestOtp,
  publicDeletionRequestOtp,
  publicDeletionVerify,
} from "@/lib/compliance";

const GENERIC_SENT = "If an account exists for this email, we have sent a code.";

type Tab = "delete" | "cancel";

/** Shared email → code step for both sections. */
function EmailCodeForm({
  idPrefix,
  sendCode,
  verify,
  verifyLabel,
  verifyVariant = "default",
}: {
  idPrefix: string;
  sendCode: (email: string) => Promise<{ message?: string }>;
  verify: (email: string, code: string) => Promise<void>;
  verifyLabel: string;
  verifyVariant?: "default" | "destructive";
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const otp = useOtpSender();

  async function send() {
    const out = await otp.send(() => sendCode(email.trim()));
    if (out) {
      setNotice(out.message || GENERIC_SENT);
      setSent(true);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await verify(email.trim(), code);
    } catch (err) {
      setError(otpErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (!sent) {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-email`}>Registered email</Label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <InlineError message={otp.error} />
        <Button type="submit" disabled={otp.sending || otp.waiting || !email.trim()}>
          {otp.sending ? "Sending…" : otp.waiting ? `Please wait ${otp.remaining} s` : "Send code"}
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onVerify} autoComplete="off">
      <InlineNotice message={notice} />
      <p className="text-sm text-muted-foreground">
        Email: <strong className="text-foreground">{email}</strong>{" "}
        <button
          type="button"
          className="text-primary underline"
          onClick={() => {
            setSent(false);
            setCode("");
            setError(null);
          }}
        >
          Change
        </button>
      </p>
      <OtpCodeInput id={`${idPrefix}-code`} value={code} onChange={setCode} />
      <InlineError message={error || otp.error} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" variant={verifyVariant} disabled={pending || code.length !== 6}>
          {pending ? "Please wait…" : verifyLabel}
        </Button>
        <ResendCodeButton remaining={otp.remaining} sending={otp.sending} onClick={() => void send()} />
      </div>
    </form>
  );
}

function DeleteSection() {
  const [, setLocation] = useLocation();
  const [token, setDeletionToken] = useState<string | null>(null);

  if (token) {
    return (
      <div className="space-y-3">
        <DeleteAccountFlow mode="public" token={token} onFinish={() => setLocation("/")} />
        <Button variant="ghost" size="sm" onClick={() => setDeletionToken(null)}>
          Start again
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Delete my account</CardTitle>
        <CardDescription>
          Enter the email address of your B-Seva account. We will email you a code to confirm it is you, then show you
          what happens to your bookings and payments before you confirm.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EmailCodeForm
          idPrefix="pub-del"
          sendCode={publicDeletionRequestOtp}
          verifyLabel="Verify email"
          verify={async (email, code) => {
            const out = await publicDeletionVerify(email, code);
            setDeletionToken(out.deletion_token);
          }}
        />
      </CardContent>
    </Card>
  );
}

function CancelSection() {
  const [done, setDone] = useState<string | null>(null);

  if (done) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
          <p className="text-sm text-foreground">{done}</p>
          <p className="text-xs text-muted-foreground">
            Bookings that were cancelled when you asked for deletion are not restored.
          </p>
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cancel a deletion request</CardTitle>
        <CardDescription>
          If you asked us to delete your account and changed your mind, you can cancel before the deletion is completed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EmailCodeForm
          idPrefix="pub-cancel"
          sendCode={cancelDeletionRequestOtp}
          verifyLabel="Cancel deletion"
          verify={async (email, code) => {
            const out = await cancelDeletion(email, code);
            setDone(out.message || "Your deletion request was cancelled. You can sign in again.");
          }}
        />
      </CardContent>
    </Card>
  );
}

export default function DeleteAccountPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tab: Tab = params.get("cancel") === "1" ? "cancel" : "delete";

  return (
    <Layout>
      <div className="container max-w-3xl space-y-6 py-12">
        <div>
          <h1 className="text-h1 mb-2">Delete Account</h1>
          <p className="text-sm text-muted-foreground">
            Customers and pujaris can ask B-Seva to delete their account here or from Profile → Account in the app.
            Your account is deactivated straight away and deleted within 14 days, except for records we must keep by
            law. See our{" "}
            <Link href="/privacy-policy" className="text-primary underline">
              Privacy Policy
            </Link>{" "}
            for details.
          </p>
        </div>
        <PortalSegmentedTabs
          value={tab}
          onChange={(id) => setLocation(id === "cancel" ? "/delete-account?cancel=1" : "/delete-account")}
          tabs={[
            { id: "delete", label: "Delete my account" },
            { id: "cancel", label: "Cancel a deletion request" },
          ]}
        />
        {tab === "delete" ? <DeleteSection /> : <CancelSection />}
      </div>
    </Layout>
  );
}
