import { PageHeader } from "@/components/page-header";
import { RankingsBoard } from "./rankings-board";

export default function RankingsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Rankings"
        description="Every org in your universe, scored and ranked. Adjust weights to re-rank live."
      />
      <RankingsBoard />
    </div>
  );
}
