import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional label shown in the fallback message. */
  label?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * App-wide error boundary. Wraps routes and heavy data widgets so a single
 * thrown calculation does not blank the entire app. UI is intentionally
 * minimal and uses semantic tokens so it inherits theme styling.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to console for debugging without crashing the tree.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", this.props.label || "", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="m-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">
              Something went wrong displaying this data.
            </div>
            <div className="mt-1 text-destructive/80">
              Please refresh the page or contact support if the problem persists.
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;