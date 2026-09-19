import type { Metadata } from "next";
import { EchoConversation } from "@/components/echo/EchoConversation";

export const metadata: Metadata = {
  title: "ECHO · MoatazOS",
  description: "Local, side-effect-free conversational runtime for MoatazOS.",
};

export default function EchoPage() {
  return <EchoConversation />;
}
