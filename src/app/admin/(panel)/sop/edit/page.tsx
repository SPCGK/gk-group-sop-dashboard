import { Suspense } from "react";
import { Loading } from "@/components/data-state";
import { SopDetail } from "@/components/admin/sop-detail";

export default function EditSopPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SopDetail />
    </Suspense>
  );
}
