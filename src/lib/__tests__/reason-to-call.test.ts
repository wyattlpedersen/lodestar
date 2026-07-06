import { describe, expect, it } from "vitest";
import { generateReasonToCall, REASON_TO_CALL_TEMPLATE_COUNT } from "../reason-to-call";
import { SIGNAL_TAXONOMY } from "../signals/taxonomy";

describe("reason-to-call templates", () => {
  it("ships at least 10 templates", () => {
    expect(REASON_TO_CALL_TEMPLATE_COUNT).toBeGreaterThanOrEqual(10);
  });

  it("covers every signal taxonomy code", () => {
    for (const entry of SIGNAL_TAXONOMY) {
      const result = generateReasonToCall({
        orgName: "Test Org",
        orgType: "private_foundation",
        assetBandLabel: "$25-100M",
        topSignalType: entry.code,
        topSignalHeadline: entry.event,
      });
      expect(result.angle.length).toBeGreaterThan(0);
      expect(result.talkingPoints).toHaveLength(3);
    }
  });

  it("falls back gracefully with no active signal", () => {
    const result = generateReasonToCall({
      orgName: "Quiet Org",
      orgType: null,
      assetBandLabel: null,
      topSignalType: null,
      topSignalHeadline: null,
    });
    expect(result.angle).toContain("Quiet Org");
    expect(result.talkingPoints).toHaveLength(3);
  });

  it("interpolates the org name into the angle", () => {
    const result = generateReasonToCall({
      orgName: "Acme Foundation",
      orgType: "private_foundation",
      assetBandLabel: "$25-100M",
      topSignalType: "RFP_ANNOUNCED",
      topSignalHeadline: "OCIO search live",
    });
    expect(result.angle).toContain("Acme Foundation");
  });
});
