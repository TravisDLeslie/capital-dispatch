import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  PackageCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import SectionHubPage from "../components/SectionHubPage";

/**
 * @param {{
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function NewHomePage({ onPageChange }) {
  return (
    <SectionHubPage
      eyebrow="New Flow"
      title="New Home"
      description="A cleaner first pass at the future Capital Dispatch flow."
      icon={LayoutDashboard}
      stats={[]}
      actionsClassName="grid gap-3"
      actions={[
        {
          icon: LayoutDashboard,
          label: "Start",
          title: "Overview",
          description: "The daily heartbeat and quick summary of what matters.",
          tone: "default",
          variant: "compact",
          onClick: () => onPageChange?.("dashboard"),
        },
        {
          icon: ShoppingCart,
          label: "Sales Flow",
          title: "Orders",
          description: "Start with customer orders and connect the work downstream.",
          tone: "marketing",
          variant: "compact",
          onClick: () => onPageChange?.("order-flow"),
        },
        {
          icon: Truck,
          label: "Material Flow",
          title: "Fulfillment",
          description: "South pickups, vendor trucks, and receiving live here.",
          tone: "dispatch",
          variant: "compact",
          onClick: () => onPageChange?.("south"),
        },
        {
          icon: ClipboardList,
          label: "Yard Flow",
          title: "Build",
          description: "A future home for load building and yard work.",
          tone: "warning",
          variant: "compact",
          onClick: () => onPageChange?.("order-builds"),
        },
        {
          icon: ClipboardCheck,
          label: "Control",
          title: "Dispatch",
          description: "Assign South runs and delivery work to the right people.",
          tone: "success",
          variant: "compact",
          onClick: () => onPageChange?.("dispatch"),
        },
        {
          icon: PackageCheck,
          label: "Outbound",
          title: "Deliveries",
          description: "Schedule, route, and complete customer deliveries.",
          tone: "marketing",
          variant: "compact",
          onClick: () => onPageChange?.("deliveries"),
        },
        {
          icon: BookOpen,
          label: "Reference",
          title: "Documents",
          description: "Stocking handbook and shared company references.",
          tone: "archive",
          variant: "compact",
          onClick: () => onPageChange?.("documents"),
        },
      ]}
    />
  );
}
