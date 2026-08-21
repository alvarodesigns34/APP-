import { createFileRoute } from "@tanstack/react-router";
import { ActivityScreen } from "@/components/screens/activity";

export const Route = createFileRoute("/actividad")({ component: ActivityScreen });
