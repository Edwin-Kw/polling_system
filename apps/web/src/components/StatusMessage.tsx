export interface StatusMessageProps {
  message: string;
  error?: boolean;
}

export function StatusMessage({ message, error = false }: StatusMessageProps) {
  return (
    <Alert variant={error ? "destructive" : "default"} role={error ? "alert" : "status"}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
import { Alert, AlertDescription } from "./ui/alert.tsx";
