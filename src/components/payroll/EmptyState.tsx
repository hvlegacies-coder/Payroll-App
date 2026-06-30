export function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-border rounded-xl p-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
