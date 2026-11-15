import { Suspense } from "react";
import { connection } from "next/server";
import { HomeCommandCentre } from "@/components/home/command-centre";
import { getHomeDashboardData } from "@/lib/dashboard/home-data";

async function HomeLoader() {
  await connection();
  const data = await getHomeDashboardData();
  return <HomeCommandCentre data={data} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex h-full min-h-[60vh] items-center justify-center text-sm text-[#777582]">Loading VYRON…</div>}>
      <HomeLoader />
    </Suspense>
  );
}
