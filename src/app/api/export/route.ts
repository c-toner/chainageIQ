import { PDFDocument, StandardFonts } from "pdf-lib";
import { context, dbError, failure, HttpError } from "@/lib/http";
import { csvCell } from "@/lib/workflow";
export async function GET(request: Request) {
  try {
    const { db } = await context(request);
    const url = new URL(request.url);
    const audit = url.searchParams.get("kind") === "audit";
    let query = db
      .from(audit ? "audit_events" : "issues")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .lte("created_at", new Date().toISOString());
    const project = url.searchParams.get("project");
    if (project) query = query.eq("project_id", project);
    if (!audit) {
      for (const key of ["status", "severity", "category"]) {
        const v = url.searchParams.get(key);
        if (v) query = query.eq(key, v);
      }
      const start = url.searchParams.get("start"),
        end = url.searchParams.get("end");
      if (start) query = query.gte("start_m", Number(start));
      if (end) query = query.lte("start_m", Number(end));
    }
    for (const [key, op] of [
      ["from", "gte"],
      ["to", "lte"],
    ] as const) {
      const v = url.searchParams.get(key);
      if (v)
        query = query[op](
          "created_at",
          key === "to" ? `${v}T23:59:59.999Z` : v,
        );
    }
    const data: Record<string, unknown>[] = [];
    let total = 1;
    while (data.length < total) {
      const {
        data: page,
        error,
        count,
      } = await query.range(data.length, data.length + 999);
      dbError(error);
      if (count === null || count >= 5000)
        throw new HttpError(
          400,
          "Narrow filters to export fewer than 5,000 records.",
        );
      total = count;
      if (!page?.length) {
        if (data.length < total)
          throw new HttpError(
            409,
            "Records changed during export. Please retry.",
          );
        break;
      }
      data.push(...page);
    }
    const keys = audit
      ? [
          "created_at",
          "actor_id",
          "entity_type",
          "entity_id",
          "action",
          "before_data",
          "after_data",
        ]
      : [
          "reference",
          "title",
          "category",
          "severity",
          "status",
          "start_m",
          "end_m",
          "due_date",
          "assignee_id",
          "resolution",
        ];
    const rows = (data ?? []).map((r) =>
      keys.map((k) =>
        typeof r[k] === "object" && r[k] !== null ? JSON.stringify(r[k]) : r[k],
      ),
    );
    if (url.searchParams.get("format") === "pdf") {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      let page = pdf.addPage([842, 595]),
        y = 555;
      const line = (s: string) => {
        if (y < 35) {
          page = pdf.addPage([842, 595]);
          y = 555;
        }
        page.drawText(s.replace(/[^\x20-\x7E]/g, "?"), {
          x: 30,
          y,
          size: 10,
          font,
        });
        y -= 16;
      };
      line(
        `ChainageIQ | ${audit ? "Audit report" : "Issue register"} | ${new Date().toISOString()}`,
      );
      line(
        `${rows.length} records. Chainage in metres. Full structured data available in CSV.`,
      );
      for (const row of rows) {
        line("");
        for (let i = 0; i < keys.length; i++) {
          const text = `${keys[i]}: ${row[i] ?? ""}`;
          for (let x = 0; x < text.length; x += 125)
            line(text.slice(x, x + 125));
        }
      }
      return new Response(new Uint8Array(await pdf.save()), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="chainageiq-report.pdf"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    return new Response(
      [keys, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="chainageiq-${audit ? "audit" : "issues"}.csv"`,
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
