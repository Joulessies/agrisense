import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
    } = body;

    if (!recipient || typeof recipient !== "string" || !recipient.includes("@")) {
      return NextResponse.json(
        { error: "A valid recipient email address is required." },
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

    // SMTP Transporter configuration
    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = Number(process.env.SMTP_PORT) || 465;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || `"AgriSense Alerts" <${smtpUser || "alerts@agrisense.com"}>`;

    if (smtpUser && smtpPass) {
      // Live SMTP Dispatch
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: smtpFrom,
        to: recipient,
        subject,
        text,
        html,
      });

      return NextResponse.json({
        success: true,
        delivered: true,
        messageId: info.messageId,
        recipient,
        type,
        subject,
      });
    } else {
      // Simulated Dev Preview Dispatch (when SMTP credentials are not yet set in .env.local)
      console.log(`\n======================================================`);
      console.log(`[AgriSense Email Dispatcher - Simulated Delivery]`);
      console.log(`To: ${recipient}`);
      console.log(`Subject: ${subject}`);
      console.log(`Type: ${type.toUpperCase()}`);
      console.log(`Time: ${timestamp}`);
      console.log(`Content:\n${text}`);
      console.log(`======================================================\n`);

      return NextResponse.json({
        success: true,
        delivered: false,
        simulated: true,
        message:
          "Email simulated and logged to server console. To dispatch live emails to real inboxes, configure SMTP_USER and SMTP_PASS in .env.local (e.g. Gmail App Password).",
        recipient,
        type,
        subject,
      });
    }
  } catch (err: any) {
    console.error("[Email Notification API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to dispatch email notification." },
      { status: 500 }
    );
  }
}

