import PivotEditor from "@/components/pivot/pivot-editor";

export default async function EditPivotPage({ params }: { params: Promise<{ pivotId: string }> }) {
  const { pivotId } = await params;
  return <PivotEditor pivotId={pivotId} />;
}
