import { describe, expect, it } from "vitest";
import { CSV_BOM, csvCell, csvFilename, csvLei, csvPercent, toCsv } from "../csv";
import type { ReportColumn } from "../types";

const columns: ReportColumn[] = [
  { key: "nume", label: "Medic", kind: "text" },
  { key: "n", label: "Facturi", kind: "int" },
  { key: "venit", label: "Venit facturat", kind: "lei" },
  { key: "rata", label: "Rata", kind: "percent" },
];

describe("csv", () => {
  it("starts with a UTF-8 BOM, uses ; and CRLF, and labels money and rates", () => {
    const csv = toCsv(columns, [{ nume: "Dr. Ana Pop", n: 3, venit: 120050, rata: 0.125 }], { nume: "Total", n: 3, venit: 120050, rata: null });
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Medic;Facturi;Venit facturat (lei);Rata (%)");
    expect(lines[1]).toBe("Dr. Ana Pop;3;1200,50;12,5");
    expect(lines[2]).toBe("Total;3;1200,50;");
    expect(lines[3]).toBe("");
  });

  it("keeps Romanian diacritics as UTF-8", () => {
    const csv = toCsv([{ key: "s", label: "Încasări", kind: "text" }], [{ s: "Ședință, ațel" }]);
    expect(Buffer.from(csv, "utf8").toString("utf8")).toContain("Ședință, ațel");
  });

  it("guards against formula injection", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+40744")).toBe("'+40744");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tx")).toBe("'\tx");
    expect(csvCell("Pop = bun")).toBe("Pop = bun");
  });

  it("quotes separators, quotes and line breaks", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('spune "da"')).toBe('"spune ""da"""');
    expect(csvCell("rând\nnou")).toBe('"rând\nnou"');
  });

  it("formats numbers for Excel in Romanian: decimal comma, no grouping, no guard on negatives", () => {
    expect(csvLei(0)).toBe("0,00");
    expect(csvLei(220000)).toBe("2200,00");
    expect(csvLei(5)).toBe("0,05");
    expect(csvLei(-12345)).toBe("-123,45");
    expect(csvPercent(0.0789)).toBe("7,9");
    expect(csvPercent(1)).toBe("100,0");
    const csv = toCsv([{ key: "v", label: "V", kind: "lei" }], [{ v: -100 }]);
    expect(csv).toContain("\r\n-1,00\r\n");
  });

  it("names the file raport-<slug>-<de>-<pana>.csv", () => {
    expect(csvFilename({ slug: "venit-medic", filters: { de: "2026-10-01", pana: "2026-10-31", clinica: "ambele", medic: null } })).toBe(
      "raport-venit-medic-2026-10-01-2026-10-31.csv",
    );
  });
});
