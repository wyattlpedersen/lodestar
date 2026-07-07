"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./overview-tab";
import { ScoreTab } from "@/components/scoring/score-tab";
import { SignalsTab } from "./signals-tab";
import { PeopleTab } from "./people-tab";
import { PeersTab } from "./peers-tab";
import { BriefingTab } from "./briefing-tab";
import { ActivityTab } from "./activity-tab";
import type { organizations, filings as filingsTable, manualFacts as manualFactsTable } from "@/lib/db/schema";
import type { DerivedFinancials } from "@/lib/derived-financials";
import type { ScoringInput, WeightProfile } from "@/lib/scoring/types";

type Org = typeof organizations.$inferSelect;
type Filing = typeof filingsTable.$inferSelect;
type ManualFact = typeof manualFactsTable.$inferSelect;

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
      <TabsList className="mx-6 mt-3 w-fit no-print">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="score">Score</TabsTrigger>
        <TabsTrigger value="signals">Signals</TabsTrigger>
        <TabsTrigger value="people">People</TabsTrigger>
        <TabsTrigger value="peers">Peers</TabsTrigger>
        <TabsTrigger value="briefing">Briefing</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-y-auto px-6 py-4 print:h-auto print:overflow-visible print:px-0 print:py-0">
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
          <SignalsTab ein={org.ein} />
        </TabsContent>
        <TabsContent value="people" className="mt-0">
          <PeopleTab ein={org.ein} />
        </TabsContent>
        <TabsContent value="peers" className="mt-0">
          <PeersTab ein={org.ein} orgName={org.name} />
        </TabsContent>
        <TabsContent value="briefing" className="mt-0">
          <BriefingTab ein={org.ein} />
        </TabsContent>
        <TabsContent value="activity" className="mt-0">
          <ActivityTab ein={org.ein} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
