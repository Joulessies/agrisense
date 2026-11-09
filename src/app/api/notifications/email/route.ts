import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { claimEpisode, episodeKeyFrom, finishEpisode, releaseEpisode } from "@/services/liveAlertState";

export const runtime = "nodejs";

function oneLine(value: unknown): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

export async function sendNotificationEmail(body: any) {
  let episode: ReturnType<typeof episodeKeyFrom> = null;
  let noticeType = "hazard";
  try {
    const {
      type = "hazard", // "hazard" | "recovery" | "disconnect" | "test"
      recipient,
      hazardType = "Critical Hazard",
      currentReading = "—",
      threshold = "—",
      timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
      zone = "Aloe Vera Zone #1",
      nodeId = "agrisense-001",
      portalUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agrisense-git.vercel.app",
      lastKnown = "",
    } = body;
    noticeType = String(type);

    const normalizedRecipient = typeof recipient === "string" ? recipient.trim().toLowerCase() : "";
    const ownerEmail = oneLine(process.env.ALERT_EMAIL).toLowerCase();
    const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const recipients = new Set<string>();
    if (isEmail(normalizedRecipient) && normalizedRecipient !== "moderator@agrisense.com") {
      recipients.add(normalizedRecipient);
    } else if (isEmail(ownerEmail)) {
      recipients.add(ownerEmail);
    }
    if (recipients.size === 0) {
      return NextResponse.json(
        { success: false, delivered: false, error: "A valid recipient email address is required." },
        { status: 400 }
      );
    }
    const to = [...recipients];

    if (!["hazard", "recovery", "disconnect", "test"].includes(type)) {
      return NextResponse.json(
        { success: false, delivered: false, error: "Unknown email notification type." },
        { status: 400 }
      );
    }

    let subject = "";
    let text = "";
    let html = "";

    // 1. Hazard Alert Email Template (Matches user's required template)
    if (type === "hazard" || type === "test") {
      const isTest = type === "test";
      subject = `${isTest ? "[TEST ALERT] " : "[CRITICAL HAZARD] "}AgriSense Alert - ${zone}: ${hazardType}`;

      text = `Dear Moderator,

AgriSense has detected a potentially hazardous condition in ${zone}.

Hazard Details

* Hazard Type: ${hazardType}
* Current Reading: ${currentReading}
* Critical Threshold: ${threshold}
* Date and Time: ${timestamp}

Recommended Action:
Please inspect the affected Aloe vera plant and its growing environment. Verify the sensor reading and assess whether corrective action is needed.

This notification indicates a potential hazard based on configured thresholds. It does not confirm plant damage or disease.

Please log in to the AgriSense Admin Portal to review the latest sensor readings and alert history.
Portal URL: ${portalUrl}

AgriSense Monitoring System
Automated Notification${isTest ? "\n\n(This is a test notification triggered from the AgriSense Settings Portal.)" : ""}`;

      html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: ${isTest ? "#d97706" : "#e11d48"}; color: #ffffff; padding: 24px; text-align: left; }
    .header h2 { margin: 0 0 6px 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 0; font-size: 13px; opacity: 0.92; }
    .content { padding: 28px 24px; }
    .greeting { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .summary { font-size: 14px; line-height: 1.5; color: #334155; margin-bottom: 20px; }
    .box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
    .box h4 { margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #9f1239; font-weight: 800; }
    .item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #fbcfe8; font-size: 13px; }
    .item:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #475569; }
    .val { font-weight: 700; color: #9f1239; }
    .rec-box { background: #f8fafc; border-left: 4px solid #059669; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px; }
    .rec-box h5 { margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #065f46; text-transform: uppercase; }
    .rec-box p { margin: 0; font-size: 13px; color: #334155; line-height: 1.45; }
    .disclaimer { font-size: 11px; color: #64748b; line-height: 1.5; margin-bottom: 24px; background: #f1f5f9; padding: 12px; border-radius: 8px; }
    .btn { display: inline-block; background: #0f172a; color: #ffffff !important; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 600; text-align: center; }
    .footer { padding: 20px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>${isTest ? "⚠️ [TEST] AgriSense Hazard Alert" : "🚨 [CRITICAL HAZARD] AgriSense Alert"}</h2>
      <p>Target Location: <strong>${zone}</strong></p>
    </div>
    <div class="content">
      <div class="greeting">Dear Moderator,</div>
      <p class="summary">AgriSense has detected a potentially hazardous condition in <strong>${zone}</strong> requiring prompt attention.</p>
      
      <div class="box">
        <h4>Hazard Details</h4>
        <div class="item"><span class="label">Hazard Type:</span><span class="val">${hazardType}</span></div>
        <div class="item"><span class="label">Current Reading:</span><span class="val">${currentReading}</span></div>
        <div class="item"><span class="label">Critical Threshold:</span><span class="val">${threshold}</span></div>
        <div class="item"><span class="label">Date & Time:</span><span class="val" style="color: #475569;">${timestamp}</span></div>
      </div>

      <div class="rec-box">
        <h5>Recommended Action</h5>
        <p>Please inspect the affected Aloe vera plant and its growing environment. Verify the sensor reading and assess whether corrective action (such as manual irrigation, greenhouse ventilation, or shade deployment) is needed.</p>
      </div>

      <div class="disclaimer">
        ℹ️ <strong>Notice:</strong> This notification indicates a potential hazard based on configured critical thresholds. It does not confirm plant damage or disease. Please verify physical field conditions.
      </div>

      <div style="text-align: center; margin-bottom: 8px;">
        <a href="${portalUrl}" class="btn">Open AgriSense Admin Portal</a>
      </div>
    </div>
    <div class="footer">
      AgriSense Monitoring System · Automated Notification Engine<br>
      Protecting Aloe Barbadensis Miller cultivation
    </div>
  </div>
</body>
</html>`;
    }

    // 2. Recovery Notification Template
    else if (type === "recovery") {
      subject = `[RESOLVED] AgriSense Hazard Cleared - ${zone}: ${hazardType}`;

      text = `Dear Moderator,

Good news. The previously detected hazardous condition in ${zone} has returned to the safe operating range.

Resolution Details

* Hazard Type: ${hazardType}
* Normalized Reading: ${currentReading}
* Safe Target Range: ${threshold}
* Date and Time: ${timestamp}

No immediate emergency action is currently required. Sensor telemetry will continue to be continuously monitored.

Please log in to the AgriSense Admin Portal to review telemetry logs:
Portal URL: ${portalUrl}

AgriSense Monitoring System
Automated Notification`;

      html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #059669; color: #ffffff; padding: 24px; text-align: left; }
    .header h2 { margin: 0 0 6px 0; font-size: 18px; font-weight: 700; }
    .header p { margin: 0; font-size: 13px; opacity: 0.92; }
    .content { padding: 28px 24px; }
    .greeting { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .summary { font-size: 14px; line-height: 1.5; color: #334155; margin-bottom: 20px; }
    .box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
    .box h4 { margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; color: #166534; font-weight: 800; }
    .item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #bbf7d0; font-size: 13px; }
    .item:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #475569; }
    .val { font-weight: 700; color: #166534; }
    .btn { display: inline-block; background: #059669; color: #ffffff !important; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 600; text-align: center; }
    .footer { padding: 20px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>✅ [RESOLVED] AgriSense Hazard Cleared</h2>
      <p>Target Location: <strong>${zone}</strong></p>
    </div>
    <div class="content">
      <div class="greeting">Dear Moderator,</div>
      <p class="summary">Conditions in <strong>${zone}</strong> have returned to safe physiological thresholds.</p>
      
      <div class="box">
        <h4>Resolution Details</h4>
        <div class="item"><span class="label">Hazard Type:</span><span class="val">${hazardType}</span></div>
        <div class="item"><span class="label">Normalized Reading:</span><span class="val">${currentReading}</span></div>
        <div class="item"><span class="label">Safe Operating Target:</span><span class="val">${threshold}</span></div>
        <div class="item"><span class="label">Resolved At:</span><span class="val" style="color: #475569;">${timestamp}</span></div>
      </div>

      <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 24px;">
        No immediate emergency intervention is required at this time. Telemetry monitoring will continue as normal.
      </p>

      <div style="text-align: center;">
        <a href="${portalUrl}" class="btn">View Live Status in Portal</a>
      </div>
    </div>
    <div class="footer">
      AgriSense Monitoring System · Automated Notification Engine
    </div>
  </div>
</body>
</html>`;
    }

    // 3. Sensor Disconnection Template
    else if (type === "disconnect") {
      subject = `[HARDWARE FAULT] AgriSense Sensor Disconnected - ${zone}`;

      text = `Dear Moderator,

AgriSense has detected a hardware or communication fault in ${zone}.

Fault Details

* Fault Type: Hardware Offline / Sensor Communication Timeout
* Affected Node: ${nodeId}
* Last Telemetry: ${timestamp}
${lastKnown ? `* Last Reading: ${lastKnown}` : ""}

Recommended Action:
Please inspect the ESP32 node power supply and local Wi-Fi connectivity. This is a hardware/communication fault and does not indicate plant damage.

Please log in to the AgriSense Admin Portal to review telemetry logs:
Portal URL: ${portalUrl}

AgriSense Monitoring System
Automated Notification`;

      html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #475569; color: #ffffff; padding: 24px; text-align: left; }
    .header h2 { margin: 0 0 6px 0; font-size: 18px; font-weight: 700; }
    .header p { margin: 0; font-size: 13px; opacity: 0.92; }
    .content { padding: 28px 24px; }
    .greeting { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .summary { font-size: 14px; line-height: 1.5; color: #334155; margin-bottom: 20px; }
    .box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
    .box h4 { margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; color: #334155; font-weight: 800; }
    .item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; }
    .item:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #475569; }
    .val { font-weight: 700; color: #0f172a; }
    .btn { display: inline-block; background: #334155; color: #ffffff !important; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 600; text-align: center; }
    .footer { padding: 20px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>🔌 [HARDWARE FAULT] Sensor Node Disconnected</h2>
      <p>Target Location: <strong>${zone}</strong></p>
    </div>
    <div class="content">
      <div class="greeting">Dear Moderator,</div>
      <p class="summary">AgriSense has detected a hardware communication fault in <strong>${zone}</strong>. Telemetry packets have ceased.</p>
      
      <div class="box">
        <h4>Fault Details</h4>
        <div class="item"><span class="label">Fault Type:</span><span class="val">Node Communication Timeout</span></div>
        <div class="item"><span class="label">Node ID:</span><span class="val">${nodeId}</span></div>
        <div class="item"><span class="label">Last Telemetry:</span><span class="val">${timestamp}</span></div>
        ${lastKnown ? `<div class="item"><span class="label">Last Reading:</span><span class="val">${lastKnown}</span></div>` : ""}
      </div>

      <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 24px;">
        Please inspect the ESP32 node power supply, breadboard connections, and local Wi-Fi router. <em>Note: This is a hardware/communication fault and does not indicate plant damage.</em>
      </p>

      <div style="text-align: center;">
        <a href="${portalUrl}" class="btn">Check Hardware Status</a>
      </div>
    </div>
    <div class="footer">
      AgriSense Monitoring System · Automated Notification Engine
    </div>
  </div>
</body>
</html>`;
    }

    if (!subject || !text) {
      return NextResponse.json(
        { success: false, delivered: false, error: "Email content could not be built for this notification." },
        { status: 400 }
      );
    }

    subject = oneLine(subject).slice(0, 180);
    episode = episodeKeyFrom(String(type), String(hazardType));
    if (episode && !claimEpisode(String(type), episode)) {
      return NextResponse.json({
        success: true,
        delivered: true,
        duplicate: true,
        recipient: to.join(", "),
        type,
        subject,
      });
    }

    const resendKey = oneLine(process.env.RESEND_API_KEY);
    const resendFrom = oneLine(process.env.RESEND_FROM) || "AgriSense Alerts <onboarding@resend.dev>";
    if (resendKey) {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to,
          subject,
          text,
          html,
        }),
      });
      const resendBody = await resendResponse.json().catch(() => ({}));
      if (!resendResponse.ok) {
        if (episode) releaseEpisode(String(type), episode);
        const resendMessage = resendBody.message || resendBody.error || "Resend rejected the email.";
        return NextResponse.json(
          { success: false, delivered: false, error: resendMessage, recipient: to.join(", "), type, subject },
          { status: resendResponse.status }
        );
      }
      if (episode) finishEpisode(String(type), episode);
      return NextResponse.json({
        success: true,
        delivered: true,
        messageId: resendBody.id,
        recipient: to.join(", "),
        type,
        subject,
      });
    }

    const smtpFrom =
      oneLine(process.env.SMTP_FROM) ||
      `"AgriSense Alerts" <${oneLine(process.env.SMTP_USER) || "alerts@agrisense.com"}>`;
    const brevoKey = oneLine(process.env.BREVO_API_KEY);
    let brevoApiError = "";
    if (brevoKey) {
      const fromMatch = smtpFrom.match(/^(.*)<([^>]+)>$/);
      const sender = fromMatch
        ? { name: fromMatch[1].replace(/"/g, "").trim() || "AgriSense Alerts", email: fromMatch[2].trim() }
        : { name: "AgriSense Alerts", email: smtpFrom };
      const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender,
          to: to.map((email) => ({ email })),
          subject,
          textContent: text,
          htmlContent: html,
        }),
      });
      const brevoBody = await brevoResponse.json().catch(() => ({}));
      if (brevoResponse.ok) {
        if (episode) finishEpisode(String(type), episode);
        return NextResponse.json({
          success: true,
          delivered: true,
          messageId: brevoBody.messageId,
          recipient: to.join(", "),
          type,
          subject,
        });
      }
      brevoApiError = brevoBody.message || brevoBody.error || "Brevo rejected the email.";
    }

    // SMTP Transporter configuration
    const smtpHost = oneLine(process.env.SMTP_HOST) || "smtp.gmail.com";
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpUser = oneLine(process.env.SMTP_USER);
    // Gmail app passwords are displayed in groups of four; spaces must be removed.
    const rawPass = process.env.SMTP_PASS?.trim() || "";
    const smtpPass = smtpHost.includes("gmail") ? rawPass.replace(/\s+/g, "") : rawPass;

    if (smtpUser && smtpPass) {
      const mail = {
        from: smtpFrom,
        to,
        subject,
        text,
        html,
      };

      const buildTransport = (family?: 4 | 6) =>
        nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          requireTLS: smtpPort === 587,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          connectionTimeout: 12_000,
          greetingTimeout: 12_000,
          socketTimeout: 20_000,
          ...(family ? { family } : {}),
        });

      let info;
      try {
        info = await buildTransport().sendMail(mail);
      } catch (firstError: any) {
        const transient = ["ETIMEDOUT", "ESOCKET", "ECONNECTION", "EAI_AGAIN", "ENOTFOUND", "ECONNREFUSED"].includes(
          firstError?.code
        );
        if (!transient) throw firstError;
        info = await buildTransport(4).sendMail(mail);
      }

      if (episode) finishEpisode(String(type), episode);
      return NextResponse.json({
        success: true,
        delivered: true,
        messageId: info.messageId,
        recipient: to.join(", "),
        type,
        subject,
      });
    }

    if (episode) releaseEpisode(String(type), episode);

    console.log(`\n======================================================`);
    console.log(`[AgriSense Email Dispatcher - Not Delivered]`);
    console.log(`To: ${to.join(", ")}`);
    console.log(`Subject: ${subject}`);
    console.log(`Type: ${String(type).toUpperCase()}`);
    console.log(`Time: ${timestamp}`);
    console.log(`Reason: SMTP_USER and SMTP_PASS are not set.`);
    console.log(`======================================================\n`);

    return NextResponse.json(
      {
        success: false,
        delivered: false,
        simulated: true,
        error:
          "Email was not delivered. Add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS to the server environment (Gmail: smtp.gmail.com, port 587, and an app password).",
        recipient: to.join(", "),
        type,
        subject,
      },
      { status: 503 }
    );
  } catch (err: any) {
    if (episode) releaseEpisode(noticeType, episode);
    console.error("[Email Notification API Error]:", err);
    const smtpResponse = typeof err?.response === "string" ? err.response : "";
    const message = smtpResponse || err?.message || "Failed to dispatch email notification.";
    return NextResponse.json(
      { success: false, delivered: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return sendNotificationEmail(await req.json());
}

