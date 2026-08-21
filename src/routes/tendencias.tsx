import { createFileRoute } from "@tanstack/react-router";
import { TrendsScreen } from "@/components/screens/trends";

export const Route = createFileRoute("/tendencias")({ component: TrendsScreen });
