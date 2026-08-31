import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ip = req.nextUrl.searchParams.get("ip");

  if (!ip) {
    return NextResponse.json({ error: "Missing IP address" }, { status: 400 });
  }

  const cleanIp = ip.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`http://${cleanIp}/api/readings`, {
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Device responded with status HTTP ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    const isTimeout = e?.name === "AbortError";
    return NextResponse.json(
      {
        error: isTimeout
          ? `Timeout connecting to ${cleanIp} — check if device is powered on and connected to the same Wi-Fi.`
          : `Failed to reach ${cleanIp}: ${e?.message || "Connection refused"}`,
      },
      { status: 504 }
    );
  }
}
