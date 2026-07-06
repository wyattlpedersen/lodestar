"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./overview-tab";
import { ScoreTab } from "@/components/scoring/score-tab";
import type { organizations, filings as filingsTable, manualFacts as manualFactsTable } from "@/lib/db/schema";
import type { DerivedFinancials } from "@/lib/derived-financials";
import type { ScoringInput, WeightProfile } from "@/lib/scoring/types";
import { EmptyState } from "@/components/empty-state";
import { Radar, Users, Building2, FileText, Activity as ActivityIcon, type LucideIcon } from "lucide-react";

type Org = typeof organizations.$inferSelect;
type Filing = typeof filingsTable.$inferSelect;
type ManualFact = typeof manualFactsTable.$inferSelect;

function ComingSoon({ icon: Icon, title, phase }: { icon: LucideIcon; title: string; phase: string }) {
  return (
    <EmptyState
      icon={Icon}
      title={title}
      description={`Arrives with ${phase}.`}
    />
  );
}

export function OrgDossier({
  org,
  filings,
  manualFacts,
  derived,
  inputs,
  activeWeights,
  activePresetName,
}: {
  org: Org;
  filings: Filing[];
  manualFacts: ManualFact[];
  derived: DerivedFinancials;
  inputs: ScoringInput[];
  activeWeights: WeightProfile;
  activePresetName: string;
}) {
  return (
    <Tabs defaultValue="overview" className="flex h-full flex-col">
      <TabsList className="mx-6 mt-3 w-fit">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="score">Score</TabsTrigger>
        <TabsTrigger value="signals">Signals</TabsTrigger>
        <TabsTrigger value="people">People</TabsTrigger>
        <TabsTrigger value="peers">Peers</TabsTrigger>
        <TabsTrigger value="briefing">Briefing</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <TabsContent value="overview" className="mt-0">
          <OverviewTab org={org} filings={filings} manualFacts={manualFacts} derived={derived} />
        </TabsContent>
        <TabsContent value="score" className="mt-0">
          <ScoreTab
            ein={org.ein}
            inputs={inputs}
            activeWeights={activeWeights}
            activePresetName={activePresetName}
          />
        </TabsContent>
        <TabsContent value="signals" className="mt-0">
          <ComingSoon icon={Radar} title="Signal timeline" phase="Phase 3 — Intelligence" />
        </TabsContent>
        <TabsContent value="people" className="mt-0">
          <ComingSoon icon={Users} title="Board & staff, trustee graph" phase="Phase 3 — Intelligence" />
        </TabsContent>
        <TabsContent value="peers" className="mt-0">
          <ComingSoon icon={Building2} title="Peer benchmarking" phase="Phase 4 — Banker workflow" />
        </TabsContent>
        <TabsContent value="briefing" className="mt-0">
          <ComingSoon icon={FileText} title="Briefing book" phase="Phase 4 — Banker workflow" />
        </TabsContent>
        <TabsContent value="activity" className="mt-0">
          <ComingSoon icon={ActivityIcon} title="Pipeline history & notes" phase="Phase 4 — Banker workflow" />
        </TabsContent>
      </div>
    </Tabs>
  );
}
