import { createFileRoute } from "@tanstack/react-router";
import { TodayScreen } from "@/components/screens/today";

export const Route = createFileRoute("/")({ component: TodayScreen });
