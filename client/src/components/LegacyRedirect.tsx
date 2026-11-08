import { Navigate, useLocation, useParams } from "react-router-dom";

/**
 * Redirects an old URL to its new home, keeping the query string, any
 * navigation state (checkout flows pass data that way) and `:param` values.
 */
export default function LegacyRedirect({ to }: { to: string }) {
  const params = useParams();
  const location = useLocation();
  const target = to.replace(/:(\w+)/g, (_, k: string) => params[k] ?? "");
  return <Navigate to={{ pathname: target, search: location.search, hash: location.hash }} state={location.state} replace />;
}
