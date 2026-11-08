export interface StatusMessageProps {
  message: string;
  error?: boolean;
}

export function StatusMessage({ message, error = false }: StatusMessageProps) {
  return (
    <Alert role={error ? "alert" : "status"}
      className={error ? "border-warning/25 bg-warning-soft text-foreground" : "bg-card"}>
      {error && <TriangleAlert aria-hidden="true" className="text-warning" />}
      <AlertDescription className="text-inherit">{message}</AlertDescription>
    </Alert>
  );
}
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert.tsx";
