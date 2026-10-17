import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data: nodes, error } = await admin
      .from("nodes")
      .select("*")
      .order("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, nodes });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to fetch nodes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, zone, type, battery = 100, signal = -52, online = true } = body;

    if (!id || !id.trim()) {
      return NextResponse.json({ error: "Missing node ID" }, { status: 400 });
    }

    const admin = createAdminClient();
    const newNode = {
      id: id.trim(),
      zone: zone || "Zone A (Greenhouse)",
      type: type || "ESP32 Sensor Hub",
      battery,
      signal,
      online,
      last_seen: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("nodes")
      .upsert([newNode])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, node: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to add node" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing node ID to delete" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Delete node directly using admin service role client (bypasses RLS)
    const { data, error } = await admin
      .from("nodes")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, deleted: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete node" }, { status: 500 });
  }
}
