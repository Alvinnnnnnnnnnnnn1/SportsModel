import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1 className="text-xl text-foreground">Page not found</h1>
      <Link className="text-primary" href="/">
        Return to overview
      </Link>
    </div>
  );
}
