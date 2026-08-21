import { createFileRoute } from "@tanstack/react-router";
import { FoodScreen } from "@/components/screens/food";

export const Route = createFileRoute("/comida")({ component: FoodScreen });
