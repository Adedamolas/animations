import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { Testimonials } from "./testimonials";

const meta = getExperiment("testimonials");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ i?: string }>;
}) {
  // ?i=<n> renders with that testimonial already active — for previewing the
  // expanded state (e.g. a long title) server-side.
  const { i } = await searchParams;
  const initialActive = i ? Math.max(0, Math.min(4, Number(i) || 0)) : 0;
  return <Testimonials initialActive={initialActive} />;
}
