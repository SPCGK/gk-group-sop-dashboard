import { Suspense } from "react";
import { MasterSop } from "@/components/admin/master-sop";
export default function Page() {
  return (
    <Suspense>
      <MasterSop />
    </Suspense>
  );
}
