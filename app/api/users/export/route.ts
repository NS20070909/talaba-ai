import { NextResponse } from "next/server";
import { exportUsersCSV, exportUsersJSON } from "@/lib/user-management";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "csv").toLowerCase();

    if (format === "json") {
      const jsonData = await exportUsersJSON();
      return new NextResponse(jsonData, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="users_export_${Date.now()}.json"`,
        },
      });
    }

    const csvData = await exportUsersCSV();
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="users_export_${Date.now()}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("User export API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
