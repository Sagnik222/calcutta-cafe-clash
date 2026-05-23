import { createFileRoute } from "@tanstack/react-router";
import Crown from "@/components/SwipeLeague";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Crown — Kolkata, ranked by you" },
      { name: "description", content: "Five quick head-to-head battles between South Kolkata cafés. Get your personal Top V." },
      { property: "og:title", content: "Crown — Kolkata, ranked by you" },
      { property: "og:description", content: "A swipe-based discovery game for Kolkata cafés." },
    ],
  }),
  component: Index,
});

function Index() {
  return <Crown />;
}
