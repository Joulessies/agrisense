import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function PATCH(req: NextRequest) {
  try {
    const { userId, role, status } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const admin = createAdminClient();

    const updates: Record<string, any> = {};
    if (role) updates.role = role;
    if (status) updates.status = status;

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 400 });
    }

    if (role) {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { role },
      });
    }

    return NextResponse.json({ success: true, profile });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const admin = createAdminClient();

    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
