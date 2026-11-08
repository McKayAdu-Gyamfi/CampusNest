import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn().mockResolvedValue({});
  return { sendMailMock, createTransportMock: vi.fn(() => ({ sendMail: sendMailMock })) };
});
vi.mock("nodemailer", () => ({ default: { createTransport: createTransportMock } }));

const { sendMail, passwordResetEmail } = await import("../src/utils/mailer.js");
const { canResetByEmail } = await import("../src/utils/passwordReset.js");

const env = { ...process.env };
beforeEach(() => {
  sendMailMock.mockClear();
  delete process.env.SMTP_HOST; delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
  process.env.NODE_ENV = "test";
});
afterEach(() => { process.env = { ...env }; vi.restoreAllMocks(); });

describe("who can reset by email", () => {
  it("students and managers can; admins, suspended and unknown accounts can't", () => {
    expect(canResetByEmail({ user_type: "STUDENT" })).toBe(true);
    expect(canResetByEmail({ user_type: "HOSTEL_MANAGER" })).toBe(true);
    expect(canResetByEmail({ user_type: "ADMIN" })).toBe(false);
    expect(canResetByEmail({ user_type: "STUDENT", suspended_at: 123 })).toBe(false);
    expect(canResetByEmail(null)).toBe(false);
  });
});

describe("password reset email", () => {
  it("contains the link, the expiry and the first name, and escapes anything unsafe", () => {
    const m = passwordResetEmail({ name: "Ama <script>", url: "https://app.test/reset?token=a&b=c" });
    expect(m.subject).toMatch(/reset/i);
    expect(m.text).toContain("https://app.test/reset?token=a&b=c");
    expect(m.text).toContain("60 minutes");
    expect(m.html).toContain("Hi Ama");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("token=a&amp;b=c");
  });
});

describe("sendMail", () => {
  it("without SMTP it sends nothing; in development it prints the link, in production it never logs the token", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await sendMail({ to: "a@x.com", subject: "S", devNote: "Reset link: https://x/t=SECRET" })).toEqual({ sent: false });
    expect(log.mock.calls.flat().join(" ")).toContain("SECRET");
    expect(createTransportMock).not.toHaveBeenCalled();

    process.env.NODE_ENV = "production";
    log.mockClear();
    await sendMail({ to: "a@x.com", subject: "S", devNote: "Reset link: https://x/t=SECRET" });
    expect([...log.mock.calls, ...err.mock.calls].flat().join(" ")).not.toContain("SECRET");
    expect(err).toHaveBeenCalled();
  });

  it("with SMTP configured it sends through the transport", async () => {
    process.env.SMTP_HOST = "smtp.test"; process.env.SMTP_PORT = "465"; process.env.SMTP_USER = "u"; process.env.SMTP_PASS = "p"; process.env.MAIL_FROM = "K <k@x.com>";
    expect(await sendMail({ to: "a@x.com", subject: "S", text: "t", html: "<p>t</p>" })).toEqual({ sent: true });
    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp.test", port: 465, secure: true, auth: { user: "u", pass: "p" } }));
    expect(sendMailMock).toHaveBeenCalledWith({ from: "K <k@x.com>", to: "a@x.com", subject: "S", text: "t", html: "<p>t</p>" });
  });
});
